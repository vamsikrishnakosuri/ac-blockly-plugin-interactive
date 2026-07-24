/**
 * Beginner-mode Lesson Runner — an AUDIO + KEYBOARD guide, not a visual panel.
 *
 * Why no on-screen panel: the audience is blind and low-vision learners using
 * screen readers. A floating panel with "Continue / Hint" buttons is a sighted
 * affordance — it covers the workspace and forces a mouse-hunt to advance. The
 * evidence-based model for blind-first tutorials (e.g. Apple's VoiceOver
 * tutorial, the Quorum language, the accessible-Blockly literature) is:
 *   speak an instruction → the learner performs the action → the system DETECTS
 *   it and confirms → it moves on. Optional hints. Verbal command affordances.
 *
 * So this runner:
 *   • SPEAKS each step through the shared aria-live queue (the primary channel).
 *   • AUTO-ADVANCES the moment the step's deterministic success criterion is
 *     true (block added, field set, program run) — no button to press.
 *   • Exposes a small set of GLOBAL keyboard commands, announced aloud, that work
 *     no matter where focus sits (modifier-based so they don't collide with
 *     Blockly's own single-key navigation):
 *        Alt+R repeat · Alt+H hint · Alt+N continue · Alt+I show written · Alt+Q quit
 *   • Mirrors the current step's TEXT into the demo's EXISTING instructions
 *     overlay (the info-button surface) so low-vision and sighted users can read
 *     it on demand — reusing existing chrome, never covering the canvas.
 *
 * It owns: progression (UnlockState), persistence (progress-store), validation
 * (criterion engine), and hints. It builds no DOM of its own.
 */

import { UnlockState } from './unlock-state.js';
import { announce, announceProgress, initLiveRegion } from '../shared/utilities/announce.js';
import { loadProgress, saveProgress } from '../shared/utilities/progress-store.js';
import { evaluateCriterion } from '../shared/utilities/criterion-checker.js';

/** Global, modifier-based commands. Codes are KeyboardEvent.code values. */
const COMMANDS = {
  repeat: { code: 'KeyR', label: 'Alt R' },
  hint: { code: 'KeyH', label: 'Alt H' },
  next: { code: 'KeyN', label: 'Alt N' },
  show: { code: 'KeyI', label: 'Alt I' },
  quit: { code: 'KeyQ', label: 'Alt Q' }
};

const COMMANDS_LINE =
  'Press Alt R to repeat, Alt H for a hint, Alt N to continue, ' +
  'Alt I to see the written step, or Alt Q to quit.';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class LessonRunner {
  /**
   * @param {Object} opts
   * @param {Array} opts.lessons - lesson data (array of lesson objects), injected
   *   rather than imported so the runner needs no JSON-module import attribute and
   *   loads cleanly both bundled and as a raw ES module in the demo.
   * @param {() => Object} opts.getWorkspace - returns the live Blockly workspace
   * @param {() => Object} [opts.getInstructions] - returns the demo's instructions
   *   overlay manager (the info-button surface) used as the on-demand visible
   *   channel. Defaults to window.instructionsManager.
   * @param {string} [opts.runButtonId='runButton']
   * @param {string} [opts.outputPanelId='outputPanel']
   * @param {boolean} [opts.autoShowWritten=true] - automatically display the
   *   written step in the reused instructions overlay (so sighted/low-vision
   *   viewers and screen-share audiences always see the current instruction).
   *   Audio remains the primary channel either way. When false, the written step
   *   is on-demand only (Alt+I / info button).
   */
  constructor(opts = {}) {
    this.lessons = Array.isArray(opts.lessons) ? opts.lessons : [];
    this.getWorkspace = opts.getWorkspace || (() => window.workspace);
    this.getInstructions =
      opts.getInstructions || (() => (typeof window !== 'undefined' ? window.instructionsManager : null));
    this.runButtonId = opts.runButtonId || 'runButton';
    this.outputPanelId = opts.outputPanelId || 'outputPanel';
    this.autoShowWritten = opts.autoShowWritten !== false;

    this.unlock = null;
    this.stepIndex = 0;
    this.hintsShown = 0;
    this.open_ = false;

    // Per-step transient state read by the criterion engine.
    this.confirmed = false;
    this.runState = { ran: false, output: '' };

    this.wsListener = null;
    this.onRunClick = null;
    this.onKeyDown = null;
    this._checkScheduled = false;
  }

  // ---- lifecycle -----------------------------------------------------------

  open() {
    if (this.open_) return;
    if (!this.lessons.length) {
      announce('Beginner lessons could not be loaded.', { assertive: true });
      return;
    }
    initLiveRegion();

    this.unlock = new UnlockState(this.lessons);
    const saved = loadProgress('beginner');
    if (saved) {
      this.unlock.loadFromProgress(saved);
      this.stepIndex = saved.currentStepIndex || 0;
    }

    this._attachWorkspaceWatch();
    this._attachRunWatch();
    this._attachKeys();
    this.open_ = true;

    announce(
      `Beginner mode. This is an audio guide: I tell you each step and listen as ` +
        `you build in the workspace. ${COMMANDS_LINE} ${this._totalLessonsLabel()}.`,
      { assertive: true }
    );
    // Let that orientation line land before the first step speaks.
    this._renderStep({ announceInstruction: true, delayAnnounce: 1600 });
  }

  close() {
    if (!this.open_) return;
    this._detachWorkspaceWatch();
    this._detachRunWatch();
    this._detachKeys();
    const im = this._instructions();
    if (im) {
      if (im.isVisible && typeof im.hide === 'function') im.hide();
      if (typeof im.clearExternalContent === 'function') im.clearExternalContent();
    }
    this.open_ = false;
    this._save();
    announce('Closed Beginner mode.', { assertive: true });
  }

  isOpen() {
    return this.open_;
  }

  // ---- progression accessors ----------------------------------------------

  _lesson() {
    return this.unlock ? this.unlock.getCurrentLesson() : null;
  }

  _step() {
    const lesson = this._lesson();
    if (!lesson || !Array.isArray(lesson.steps)) return null;
    return lesson.steps[this.stepIndex] || null;
  }

  _isExplainer(step) {
    return !!(step && step.successCriterion && step.successCriterion.type === 'userConfirmation');
  }

  _totalLessonsLabel() {
    const p = this.unlock.getProgress();
    return `Lesson ${p.currentLessonIndex + 1} of ${p.totalLessons}`;
  }

  _instructions() {
    try {
      return this.getInstructions ? this.getInstructions() : null;
    } catch (_e) {
      return null;
    }
  }

  // ---- the watched context -------------------------------------------------

  _ctx() {
    return {
      workspace: this.getWorkspace(),
      confirmed: this.confirmed,
      runState: this.runState
    };
  }

  // ---- workspace + run hooks ----------------------------------------------

  _attachWorkspaceWatch() {
    const ws = this.getWorkspace();
    if (!ws || typeof ws.addChangeListener !== 'function') return;
    this.wsListener = () => this._scheduleCheck();
    ws.addChangeListener(this.wsListener);
  }

  _detachWorkspaceWatch() {
    const ws = this.getWorkspace();
    if (ws && this.wsListener && typeof ws.removeChangeListener === 'function') {
      ws.removeChangeListener(this.wsListener);
    }
    this.wsListener = null;
  }

  _attachRunWatch() {
    const btn = document.getElementById(this.runButtonId);
    if (!btn) return;
    this.onRunClick = () => {
      // The demo runs the program and writes output synchronously on click; read
      // it on the next tick so we capture the fresh output.
      setTimeout(() => {
        this.runState.ran = true;
        const panel = document.getElementById(this.outputPanelId);
        this.runState.output = panel ? panel.textContent || '' : '';
        this._scheduleCheck();
      }, 0);
    };
    btn.addEventListener('click', this.onRunClick);
  }

  _detachRunWatch() {
    const btn = document.getElementById(this.runButtonId);
    if (btn && this.onRunClick) btn.removeEventListener('click', this.onRunClick);
    this.onRunClick = null;
  }

  // ---- keyboard commands ---------------------------------------------------

  _attachKeys() {
    this.onKeyDown = (e) => {
      if (!this.open_) return;
      // Only modifier-based combos, and only plain Alt (not Ctrl/Meta/Alt-Graph),
      // so we never swallow Blockly's single-key navigation or OS shortcuts.
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      let handled = true;
      switch (e.code) {
        case COMMANDS.repeat.code:
          this._repeat();
          break;
        case COMMANDS.hint.code:
          this._onHint();
          break;
        case COMMANDS.next.code:
          this._onNext();
          break;
        case COMMANDS.show.code:
          this._showWritten();
          break;
        case COMMANDS.quit.code:
          this.close();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', this.onKeyDown, true);
  }

  _detachKeys() {
    if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown, true);
    this.onKeyDown = null;
  }

  // ---- check / advance -----------------------------------------------------

  // Coalesce the bursts of change events Blockly fires for one user action into a
  // single criterion check.
  _scheduleCheck() {
    if (this._checkScheduled || !this.open_) return;
    this._checkScheduled = true;
    setTimeout(() => {
      this._checkScheduled = false;
      this._checkCurrentStep();
    }, 60);
  }

  _checkCurrentStep() {
    const step = this._step();
    if (!step || !step.successCriterion) return;
    if (evaluateCriterion(step.successCriterion, this._ctx())) {
      this._passStep();
    }
  }

  _passStep() {
    const lesson = this._lesson();
    const step = this._step();
    if (!lesson || !step) return;

    announce(step.successText || 'Correct! Step complete.', { assertive: true });

    // Reset per-step transient state.
    this.confirmed = false;
    this.runState = { ran: false, output: '' };
    this.hintsShown = 0;

    if (this.stepIndex < lesson.steps.length - 1) {
      this.stepIndex += 1;
      this._save();
      // Give the success line a beat before the next instruction speaks.
      this._renderStep({ announceInstruction: true, delayAnnounce: 1100 });
      return;
    }
    this._completeLesson();
  }

  _completeLesson() {
    const finished = this._lesson();
    const next = this.unlock.completeCurrentLesson();
    this.stepIndex = 0;
    this._save();

    if (next) {
      const p = this.unlock.getProgress();
      announce(
        `Lesson complete: ${finished.title}. Next lesson: ${next.title}.`,
        { assertive: true }
      );
      announceProgress(p.completedCount, p.totalLessons, 'lessons');
      this._renderStep({ announceInstruction: true, delayAnnounce: 1600 });
    } else {
      announce(
        `You finished the last lesson: ${finished.title}. That completes Beginner ` +
          `mode — congratulations! Press Alt Q to quit, or keep building.`,
        { assertive: true }
      );
      this._pushWritten(
        'Beginner mode complete',
        '<div class="instruction-item instruction-title">Beginner mode complete</div>' +
          '<div class="instruction-item instruction-goal">You have completed every ' +
          'Beginner lesson. Keep building, or press Alt Q to quit the guide.</div>'
      );
    }
  }

  // ---- command actions -----------------------------------------------------

  _repeat() {
    const step = this._step();
    if (!step) return;
    const tail = this._isExplainer(step) ? ' Press Alt N to continue.' : '';
    announce(`${step.screenReaderHint || step.instruction}${tail}`, { assertive: true });
  }

  _onNext() {
    const step = this._step();
    if (!step) return;
    if (this._isExplainer(step)) {
      this.confirmed = true;
      this._checkCurrentStep();
      return;
    }
    // Build steps advance themselves from the workspace; make that explicit
    // instead of silently doing nothing.
    announce(
      'This step advances on its own when you build it in the workspace. ' +
        'Press Alt H for a hint, or Alt I to read the step.',
      { assertive: true }
    );
  }

  _onHint() {
    const lesson = this._lesson();
    if (!lesson || !Array.isArray(lesson.hints) || lesson.hints.length === 0) {
      announce('No hints for this lesson.', { assertive: true });
      return;
    }
    if (this.hintsShown >= lesson.hints.length) {
      announce('No more hints. Press Alt R to hear the step again.', { assertive: true });
      return;
    }
    const hint = lesson.hints[this.hintsShown];
    this.hintsShown += 1;
    announce(`Hint ${this.hintsShown}: ${hint}`, { assertive: true });
    this._syncWritten(); // refresh the written panel so the hint shows there too
  }

  _showWritten() {
    const im = this._instructions();
    if (im && typeof im.show === 'function') {
      im.show();
    } else {
      announce('The written step view is not available here.', { assertive: true });
    }
  }

  // ---- persistence ---------------------------------------------------------

  _save() {
    if (!this.unlock) return;
    saveProgress('beginner', {
      ...this.unlock.exportForSave(),
      currentStepIndex: this.stepIndex
    });
  }

  // ---- rendering (audio + the reused written surface) ----------------------

  _renderStep({ announceInstruction = false, delayAnnounce = 0 } = {}) {
    const step = this._step();
    if (!step) return;

    this._syncWritten();

    // Keep the written step visible on screen for sighted/low-vision viewers.
    // setExternalContent already live-refreshes the body when the overlay is
    // open, so we only need to OPEN it once (when not already visible) — that
    // avoids re-stealing focus on every step.
    if (this.autoShowWritten) {
      const im = this._instructions();
      if (im && !im.isVisible && typeof im.show === 'function') im.show();
    }

    if (announceInstruction) {
      const speak = () => {
        const step2 = this._step();
        if (!step2) return;
        const tail = this._isExplainer(step2) ? ' Press Alt N to continue.' : '';
        announce(`${step2.screenReaderHint || step2.instruction}${tail}`, { assertive: true });
      };
      if (delayAnnounce > 0) setTimeout(speak, delayAnnounce);
      else speak();
    }

    // A build step might already be satisfied (e.g. a leftover block). Check.
    this._scheduleCheck();
  }

  /** Build the current step's HTML and push it into the reused instructions
   *  overlay (and refresh it live if the user has it open). */
  _syncWritten() {
    const lesson = this._lesson();
    const step = this._step();
    if (!lesson || !step) return;
    const p = this.unlock.getProgress();
    const hints = Array.isArray(lesson.hints) ? lesson.hints.slice(0, this.hintsShown) : [];
    const hintHtml = hints
      .map(
        (h, i) =>
          `<div class="instruction-item instruction-feedback">Hint ${i + 1}: ${escapeHtml(h)}</div>`
      )
      .join('');
    const html =
      `<div class="instruction-item instruction-title">${escapeHtml(lesson.title)} — ` +
        `Step ${this.stepIndex + 1} of ${lesson.steps.length}</div>` +
      `<div class="instruction-item instruction-goal">${escapeHtml(step.instruction)}</div>` +
      hintHtml +
      `<div class="instruction-item instruction-completion">Lesson ${p.currentLessonIndex + 1} ` +
        `of ${p.totalLessons}. Audio commands — ${escapeHtml(COMMANDS_LINE)}</div>`;
    this._pushWritten(lesson.title, html);
  }

  _pushWritten(title, html) {
    const im = this._instructions();
    if (im && typeof im.setExternalContent === 'function') {
      im.setExternalContent(html, title);
    }
  }
}
