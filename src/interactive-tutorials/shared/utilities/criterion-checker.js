/**
 * Deterministic success-criterion engine for Beginner-mode lessons.
 *
 * A lesson step says what the learner must do as a small, machine-checkable
 * `successCriterion`. This module reads the REAL Blockly workspace the learner
 * is building in and answers one yes/no question: "is this step satisfied right
 * now?" The lesson runner re-asks on every workspace change and advances when
 * the answer turns true.
 *
 * Why deterministic (no AI/LLM grading): the audience is blind and
 * vision-impaired learners using screen readers, often offline. A check that is
 * predictable, instant, and explainable ("you now have a print block") is far
 * kinder than a probabilistic grader that can disagree with itself. Everything
 * here is plain block inspection.
 *
 * The engine never imports Blockly. It only uses the block instance methods that
 * exist on every Blockly block (type, getParent, getFieldValue,
 * getInputTargetBlock, isShadow…), so it can be unit-tested with simple fakes
 * and stays decoupled from any particular Blockly build.
 *
 * Context object (ctx) supplied by the runner:
 *   {
 *     workspace,            // the live Blockly.WorkspaceSvg the learner edits
 *     confirmed: boolean,   // learner pressed Continue (for explainer steps)
 *     runState: {           // tracked by the runner's Run hook
 *       ran: boolean,       // Run was pressed at least once this step
 *       output: string      // text captured from the output panel on last run
 *     }
 *   }
 *
 * Criterion vocabulary (criterion = { type, params }):
 *   userConfirmation  {}                                   learner pressed Continue
 *   blockExists       { blockType, count?, includeShadows? } ≥count real blocks of a type exist
 *   blockConnected    { childType, parentType?, input? }    a child block is plugged into a parent
 *   fieldSet          { blockType, field, value?, notValues?, caseInsensitive? }
 *                                                           a block's field holds (or no longer holds) a value
 *   programRan        {}                                    learner pressed Run
 *   outputContains    { text, caseInsensitive? }            the run output includes some text
 *   allOf             { criteria: [...] }                   every sub-criterion is satisfied
 *   anyOf             { criteria: [...] }                   at least one sub-criterion is satisfied
 */

/**
 * Top-level evaluator. Returns true when the criterion is satisfied by the
 * current context, false otherwise. Unknown / malformed criteria return false
 * so a typo can never silently auto-pass a step.
 *
 * @param {Object} criterion - { type, params }
 * @param {Object} ctx - runner context (see file header)
 * @returns {boolean}
 */
export function evaluateCriterion(criterion, ctx) {
  if (!criterion || typeof criterion !== 'object') return false;
  const params = criterion.params || {};
  const ws = ctx && ctx.workspace;

  switch (criterion.type) {
    case 'userConfirmation':
      return !!(ctx && ctx.confirmed);

    case 'blockExists':
      return (
        countBlocks(ws, params.blockType, !!params.includeShadows) >=
        (typeof params.count === 'number' ? params.count : 1)
      );

    case 'blockConnected':
      return hasConnection(ws, params);

    case 'fieldSet':
      return hasFieldSet(ws, params);

    case 'programRan':
      return !!(ctx && ctx.runState && ctx.runState.ran);

    case 'outputContains':
      return outputContains(ctx, params);

    case 'allOf':
      return (
        Array.isArray(params.criteria) &&
        params.criteria.length > 0 &&
        params.criteria.every((c) => evaluateCriterion(c, ctx))
      );

    case 'anyOf':
      return (
        Array.isArray(params.criteria) &&
        params.criteria.some((c) => evaluateCriterion(c, ctx))
      );

    default:
      return false;
  }
}

/**
 * Every real (non-insertion-marker) block on the workspace. Shadow blocks — the
 * grey placeholder values Blockly pre-fills into inputs — are included or not
 * per the caller, because "add a number block" should NOT be satisfied by the
 * shadow number that came free inside a print block.
 *
 * @param {Object} ws
 * @param {boolean} includeShadows
 * @returns {Array} block instances
 */
function allBlocks(ws, includeShadows) {
  if (!ws || typeof ws.getAllBlocks !== 'function') return [];
  return ws.getAllBlocks(false).filter((b) => {
    if (!b) return false;
    if (typeof b.isInsertionMarker === 'function' && b.isInsertionMarker()) {
      return false;
    }
    if (!includeShadows && typeof b.isShadow === 'function' && b.isShadow()) {
      return false;
    }
    return true;
  });
}

/**
 * How many real blocks of a given type exist. With no type, counts all real
 * blocks (handy for a "place any block" first step).
 */
function countBlocks(ws, blockType, includeShadows) {
  const blocks = allBlocks(ws, includeShadows);
  if (!blockType) return blocks.length;
  return blocks.filter((b) => b.type === blockType).length;
}

/**
 * True when some child block is connected into a parent block. The match is
 * intentionally forgiving so lessons can be loose ("connect a text block into
 * the print") or precise ("…into the print's TEXT input"):
 *   childType  (required) the block that must be plugged in
 *   parentType (optional) what it must be plugged into; any parent if omitted
 *   input      (optional) the named input slot it must sit in
 * Shadow children never count — the learner has to add a real block.
 */
function hasConnection(ws, params) {
  const { childType, parentType, input } = params || {};
  if (!childType) return false;
  const children = allBlocks(ws, false).filter((b) => b.type === childType);

  return children.some((child) => {
    const parent =
      typeof child.getParent === 'function' ? child.getParent() : null;
    if (!parent) return false;
    if (parentType && parent.type !== parentType) return false;
    if (input) {
      const target =
        typeof parent.getInputTargetBlock === 'function'
          ? parent.getInputTargetBlock(input)
          : null;
      return target === child;
    }
    return true;
  });
}

/**
 * True when a block of the given type has a field set the way the step wants:
 *   value        the field must equal this exactly
 *   notValues[]  the field must NOT equal any of these (e.g. the shadow default,
 *                so "type your own message" isn't satisfied by leaving 'abc')
 * With neither, any non-empty field value counts. Comparison is string-based and
 * optionally case-insensitive.
 */
function hasFieldSet(ws, params) {
  const { blockType, field, value, notValues, caseInsensitive } = params || {};
  if (!blockType || !field) return false;
  const norm = (v) => {
    const s = v == null ? '' : String(v);
    return caseInsensitive ? s.toLowerCase() : s;
  };
  const blocks = allBlocks(ws, true).filter((b) => b.type === blockType);

  return blocks.some((b) => {
    if (typeof b.getFieldValue !== 'function') return false;
    const raw = b.getFieldValue(field);
    if (raw == null) return false;
    const cur = norm(raw);
    if (value != null) return cur === norm(value);
    if (Array.isArray(notValues)) {
      return cur !== '' && !notValues.map(norm).includes(cur);
    }
    return cur !== '';
  });
}

/**
 * True when the captured run output contains the expected text. Reads the
 * runner-captured string first, then falls back to the live output panel in the
 * DOM so it still works if the runner didn't capture.
 */
function outputContains(ctx, params) {
  const { text, caseInsensitive } = params || {};
  if (!text) return false;
  let out = (ctx && ctx.runState && ctx.runState.output) || '';
  if (!out && typeof document !== 'undefined') {
    const panel = document.getElementById('outputPanel');
    out = panel ? panel.textContent || '' : '';
  }
  if (caseInsensitive) {
    return out.toLowerCase().includes(String(text).toLowerCase());
  }
  return out.includes(String(text));
}

/**
 * The set of criterion types the engine understands. Exposed so the lesson
 * validator can reject a lesson that references a type the runner can't check
 * (catching authoring typos before they ship).
 */
export const SUPPORTED_CRITERION_TYPES = [
  'userConfirmation',
  'blockExists',
  'blockConnected',
  'fieldSet',
  'programRan',
  'outputContains',
  'allOf',
  'anyOf'
];
