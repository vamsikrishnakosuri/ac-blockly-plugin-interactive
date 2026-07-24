/**
 * Practice programs for the Keyboard Trainer's live sandbox.
 *
 * Movement, editing, and "where can I go" shortcuts only mean anything when
 * there are real blocks under the cursor. Rather than borrow one of the demo's
 * teaching tasks (which are large, multi-stack, and tuned for a different
 * lesson), the trainer loads this small, purpose-built stack: one container
 * block (a repeat loop) with two children inside it and a sibling after it.
 *
 * That shape is deliberate — from the centre block every core cursor move is
 * valid, so the learner always sees the cursor actually move:
 *   W (previous) / A (out to parent) / S (next) / D (in to a child value).
 *
 * The block ids are stable and referenced by PRACTICE_ANCHORS so the live
 * adapter can park the cursor on a known block before each drill.
 */

export const NAVIGATION_PRACTICE_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="controls_repeat_ext" id="practice-loop" x="60" y="60">
    <value name="TIMES">
      <block type="math_number" id="practice-times"><field name="NUM">3</field></block>
    </value>
    <statement name="DO">
      <block type="text_print" id="practice-print-1">
        <value name="TEXT">
          <block type="text" id="practice-text-1"><field name="TEXT">First step</field></block>
        </value>
        <next>
          <block type="text_print" id="practice-print-2">
            <value name="TEXT">
              <block type="text" id="practice-text-2"><field name="TEXT">Second step</field></block>
            </value>
          </block>
        </next>
      </block>
    </statement>
    <next>
      <block type="text_print" id="practice-print-after">
        <value name="TEXT">
          <block type="text" id="practice-text-after"><field name="TEXT">All done</field></block>
        </value>
      </block>
    </next>
  </block>
</xml>`;

/**
 * A spoken, structural walk-through of NAVIGATION_PRACTICE_XML for BVI learners.
 * Announced when the trainer drops the learner into the practice stack so they
 * know what is on the workspace before being asked to move around it — what
 * blocks exist, how they nest, and what each one says.
 */
export const NAVIGATION_PRACTICE_DESCRIPTION =
  'Here is the practice program. At the top is a repeat loop set to run three ' +
  'times. Nested inside the loop are two print blocks: the first prints the ' +
  'text "First step", the second prints "Second step". After the loop, on its ' +
  'own, is a third print block that prints "All done".';

/**
 * Named cursor anchors → block ids in NAVIGATION_PRACTICE_XML. The trainer asks
 * the adapter to place the cursor at one of these before a movement drill.
 * Each move is only valid from certain spots (you cannot go "up" from the top
 * block), so every drill parks the cursor on an anchor where its key really
 * moves:
 *   firstChild  - first print in the loop; S (next) and D (in) move from here
 *   secondChild - second print; W (previous) moves up to the first
 *   value       - the number in the loop counter; A (out) moves up to the loop
 *   container   - the repeat loop itself
 *   sibling     - the print after the loop
 */
export const PRACTICE_ANCHORS = {
  center: 'practice-print-1',
  container: 'practice-loop',
  firstChild: 'practice-print-1',
  secondChild: 'practice-print-2',
  value: 'practice-times',
  sibling: 'practice-print-after'
};

/**
 * Friendly spoken names for the block types used above, so a cue can say where
 * the cursor landed ("you are now on the repeat loop") instead of a raw type.
 */
export const BLOCK_FRIENDLY_NAMES = {
  controls_repeat_ext: 'the repeat loop',
  controls_whileUntil: 'the while loop',
  controls_if: 'the if-else block',
  logic_boolean: 'a true-or-false value',
  text_print: 'a print block',
  text: 'a text value',
  math_number: 'a number'
};

// ===========================================================================
// TWO-STACK SCENE
//
// The flowing curriculum opens on an empty canvas (marker practice), then —
// once the learner has met the toolbox and placed a block — swaps in this
// richer scene for everything from cursor movement through editing and stack
// labels. Two separate stacks, each with more than one block, because several
// later moves need exactly that:
//   • W / S need vertical siblings to move between        → each stack is a column
//   • A / D and F / Q need nesting                        → both stacks nest blocks
//   • Opt+Shift+G ("jump to Stack B's second block") needs a real second stack
//     with a real second block to aim at
//   • Shift+F needs blocks with inner values (the if's condition, the while's
//     condition) to drop the cursor onto
//
// Stack A: an if-else block (a print in each branch) followed by one more print.
//          The cursor starts on the if-else block — "press S to go down".
// Stack B: a while loop (a print nested inside) followed by one more print.
//
// Ids are stable and namespaced (sa- / sb-) so TWO_STACK_ANCHORS can park the
// cursor anywhere a drill needs to begin.
// ===========================================================================
export const TWO_STACK_PRACTICE_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="controls_if" id="sa-if" x="40" y="40">
    <mutation else="1"></mutation>
    <value name="IF0">
      <block type="logic_boolean" id="sa-cond"><field name="BOOL">TRUE</field></block>
    </value>
    <statement name="DO0">
      <block type="text_print" id="sa-print-if">
        <value name="TEXT">
          <block type="text" id="sa-text-if"><field name="TEXT">If branch</field></block>
        </value>
      </block>
    </statement>
    <statement name="ELSE">
      <block type="text_print" id="sa-print-else">
        <value name="TEXT">
          <block type="text" id="sa-text-else"><field name="TEXT">Else branch</field></block>
        </value>
      </block>
    </statement>
    <next>
      <block type="text_print" id="sa-print-after">
        <value name="TEXT">
          <block type="text" id="sa-text-after"><field name="TEXT">After the if</field></block>
        </value>
      </block>
    </next>
  </block>
  <block type="controls_whileUntil" id="sb-while" x="320" y="40">
    <field name="MODE">WHILE</field>
    <value name="BOOL">
      <block type="logic_boolean" id="sb-cond"><field name="BOOL">TRUE</field></block>
    </value>
    <statement name="DO">
      <block type="text_print" id="sb-print-inner">
        <value name="TEXT">
          <block type="text" id="sb-text-inner"><field name="TEXT">Inside the loop</field></block>
        </value>
      </block>
    </statement>
    <next>
      <block type="text_print" id="sb-print-after">
        <value name="TEXT">
          <block type="text" id="sb-text-after"><field name="TEXT">Stack B second</field></block>
        </value>
      </block>
    </next>
  </block>
</xml>`;

/**
 * Spoken walk-through of the two-stack scene, announced when it loads so a BVI
 * learner knows the shape of the canvas before moving around it.
 */
export const TWO_STACK_PRACTICE_DESCRIPTION =
  'Here are two separate stacks. Stack A, on the left, starts with an if-else ' +
  'block: when its test is true it prints "If branch", otherwise it prints ' +
  '"Else branch"; below the if-else is one more print that says "After the if". ' +
  'Stack B, on the right, is a while loop that prints "Inside the loop" while ' +
  'its test is true, and below the loop one more print that says "Stack B ' +
  'second". Your cursor starts on the if-else block at the top of Stack A.';

/**
 * Cursor anchors for the two-stack scene. Same idea as PRACTICE_ANCHORS: park
 * the cursor where a drill's key is valid before asking the learner to press it.
 */
export const TWO_STACK_ANCHORS = {
  // Stack A
  aStart: 'sa-if',          // if-else block — where the cursor starts
  aIf: 'sa-if',
  aAfter: 'sa-print-after', // the print below the if-else (S moves here)
  aIfPrint: 'sa-print-if',  // print nested in the IF branch (F lands here)
  aCond: 'sa-cond',         // the if's true/false condition (Shift+F target)
  // Stack B
  bStart: 'sb-while',
  bWhile: 'sb-while',
  bInner: 'sb-print-inner', // print nested inside the while
  bSecond: 'sb-print-after', // Stack B's second block (Opt+Shift+G target)
  bCond: 'sb-cond'          // the while's condition (Shift+F target)
};

/**
 * Scene registry. The trainer asks the adapter to load a scene by id at the
 * point in the curriculum where it is needed: an empty canvas for the very
 * first marker drills, the original single-stack program where it still fits,
 * and the two-stack scene for cursor movement, editing, and stack labels.
 */
export const PRACTICE_SCENES = {
  empty: {
    xml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
    description: 'The workspace is empty — a blank canvas with no blocks yet.',
    anchors: {}
  },
  nav: {
    xml: NAVIGATION_PRACTICE_XML,
    description: NAVIGATION_PRACTICE_DESCRIPTION,
    anchors: PRACTICE_ANCHORS
  },
  twoStack: {
    xml: TWO_STACK_PRACTICE_XML,
    description: TWO_STACK_PRACTICE_DESCRIPTION,
    anchors: TWO_STACK_ANCHORS
  }
};
