/**
 * Keyboard Trainer
 *
 * An audio-first, self-paced trainer for the plugin's keyboard shortcuts. It is
 * launched from a persistent keyboard icon and is available in any mode.
 *
 * Per-shortcut loop:  ANNOUNCE -> PROMPT -> (DETECT) -> CONFIRM -> next
 *   ANNOUNCE  speak what the shortcut does (verbosity-tier dependent).
 *   PROMPT    offer "Try it", "Hear again", "Skip".
 *   DETECT    listen for the real keypress (standalone shortcuts only).
 *   CONFIRM   speak success, mark mastered, advance.
 *
 * Design notes grounded in the BVI co-design sessions:
 *   - One announcement at a time; terse by default with a verbosity control.
 *   - Repetition is free: "Hear again" and "Try again" carry no penalty.
 *   - Demonstrate, then let the learner try — matching participant requests.
 *   - Shortcuts that only make sense on a live workspace (movement, edit) are
 *     gated behind `requiresSandbox` and demonstrated, not yet practiced. They
 *     unlock once a practice workspace is wired in (a later, separate step).
 */

import { trapFocus, popFocus, pushFocus } from '../utilities/focus-manager.js';
import { announce, initLiveRegion } from '../utilities/announce.js';
import { loadProgress, saveProgress } from '../utilities/progress-store.js';
import {
  KEYBOARD_TRACKS,
  matchesShortcut,
  canonicalDetail,
  getAllShortcuts,
  searchShortcuts
} from '../data/keyboard-tracks.js';

const PROGRESS_MODE = 'keyboard-trainer';
const LISTEN_TIMEOUT_MS = 9000;
const VERBOSITY = { TERSE: 'terse', DEFAULT: 'default', NOVICE: 'novice' };

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.id = 'keyboard-trainer-styles';
  style.textContent = `
    .kbt-overlay { position: fixed; inset: 0; display: flex; align-items: center;
      justify-content: center; padding: var(--spacing-lg, 24px);
      background: rgba(0,0,0,0.7); z-index: var(--z-modal, 500); }
    .kbt-dialog { background: var(--color-surface-elevated, #fff);
      color: var(--color-text-primary, #212529); border-radius: var(--radius-lg, 12px);
      width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto;
      padding: var(--spacing-xl, 32px); box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: var(--font-family-base, sans-serif); }
    .kbt-dialog *:focus-visible { outline: var(--focus-outline-width, 3px)
      var(--focus-outline-style, solid) var(--color-focus, #0066cc);
      outline-offset: var(--focus-outline-offset, 2px); }
    .kbt-btn { font-size: var(--font-size-base, 1rem); padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
      border-radius: var(--radius-md, 8px); border: 1px solid var(--color-border-strong, #adb5bd);
      background: var(--color-surface, #f8f9fa); color: var(--color-text-primary, #212529);
      cursor: pointer; }
    .kbt-btn:hover { background: var(--color-hover-background, #e9ecef); }
    .kbt-btn:disabled { color: var(--color-disabled-text, #6c757d);
      background: var(--color-locked-background, #e9ecef); cursor: not-allowed; }
    .kbt-btn-primary { background: var(--color-focus, #0066cc); color: #fff;
      border-color: var(--color-focus, #0066cc); }
    .kbt-btn-primary:hover { filter: brightness(1.08); background: var(--color-focus, #0066cc); }
    /* Skip: a deliberately distinct, light-red target. High-contrast (dark-red
       text on a soft-red field, bold red border) so low-vision learners can
       pick it out without reading it; it is also the first focusable control. */
    .kbt-btn-skip { background: #fde8ea; color: #8a1c24; border: 2px solid #d83a48;
      font-weight: 600; }
    .kbt-btn-skip:hover { background: #f9d2d6; }
    .kbt-listening { background: var(--color-info-background, #cff4fc);
      border: 2px solid var(--color-info, #055160); border-radius: var(--radius-md, 8px);
      padding: var(--spacing-md, 16px); animation: kbt-pulse 1.4s ease-in-out infinite; }
    @keyframes kbt-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.72; } }
    @media (prefers-reduced-motion: reduce) { .kbt-listening { animation: none; } }
    .kbt-kbd { font-family: var(--font-family-mono, monospace);
      background: var(--color-surface, #f8f9fa); border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-sm, 4px); padding: 2px 6px; }
    /* Live coach: the backdrop drops out so the real workspace stays usable,
       and the dialog docks to the bottom as a compact, non-modal bar. */
    .kbt-overlay--coach { background: transparent; pointer-events: none;
      align-items: flex-end; padding: 0; }
    .kbt-overlay--coach .kbt-dialog { pointer-events: auto; max-width: 760px;
      max-height: 42vh; margin: 0 auto var(--spacing-lg, 24px);
      box-shadow: 0 -8px 32px rgba(0,0,0,0.3);
      border: 2px solid var(--color-focus, #0066cc); }
    .kbt-cue { position: fixed; top: 16px; left: 50%;
      transform: translateX(-50%) translateY(-12px);
      background: var(--color-success, #0f5132); color: #fff;
      padding: 10px 18px; border-radius: var(--radius-md, 8px); font-weight: 600;
      z-index: var(--z-toast, 700); opacity: 0; pointer-events: none;
      max-width: 90vw; text-align: center;
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      transition: opacity 0.25s ease, transform 0.25s ease; }
    .kbt-cue--show { opacity: 1; transform: translateX(-50%) translateY(0); }
    @media (prefers-reduced-motion: reduce) { .kbt-cue { transition: none; } }
    /* Front door: searchable index the trainer opens into. */
    .kbt-sr-only { position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .kbt-search-input { width: 100%; box-sizing: border-box;
      font-size: var(--font-size-base, 1rem);
      padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
      border: 1px solid var(--color-border-strong, #adb5bd);
      border-radius: var(--radius-md, 8px); }
    .kbt-listbox { list-style: none; margin: var(--spacing-sm, 8px) 0 0; padding: 0;
      max-height: 240px; overflow-y: auto; }
    .kbt-listbox:focus { outline: 2px solid var(--color-focus, #0066cc);
      outline-offset: 2px; border-radius: var(--radius-sm, 4px); }
    .kbt-option { padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
      border-radius: var(--radius-sm, 4px); cursor: pointer; }
    .kbt-option--active { background: var(--color-info-background, #cff4fc);
      outline: 2px solid var(--color-focus, #0066cc); outline-offset: -2px; }
    .kbt-option--empty { color: var(--color-text-secondary, #6c757d); cursor: default; }
    .kbt-option-key { font-family: var(--font-family-mono, monospace); }
    .kbt-option-track { color: var(--color-text-secondary, #6c757d);
      font-size: var(--font-size-sm, 0.875rem); }
    .kbt-index-list { list-style: none; padding: 0; margin: 0 0 var(--spacing-md, 16px); }
    .kbt-index-item { display: block; width: 100%; text-align: left; background: none;
      border: none; padding: var(--spacing-sm, 8px); border-radius: var(--radius-sm, 4px);
      cursor: pointer; color: var(--color-text-primary, #212529);
      font-size: var(--font-size-base, 1rem); }
    .kbt-index-item:hover { background: var(--color-hover-background, #e9ecef); }
    .kbt-index-item:focus-visible { outline: 3px solid var(--color-focus, #0066cc);
      outline-offset: -3px; background: var(--color-info-background, #cff4fc); }
    .kbt-index-key { font-family: var(--font-family-mono, monospace);
      color: var(--color-text-secondary, #6c757d); }
    /* Lesson card as a stepped, self-voicing item list (W/S or arrows to walk;
       each row is one discrete item a screen reader announces on landing). */
    .kbt-card { margin: var(--spacing-lg, 24px) 0; border-radius: var(--radius-md, 8px);
      overflow: hidden; border: 1px solid var(--color-border-strong, #adb5bd); }
    .kbt-item { display: flex; gap: var(--spacing-md, 16px);
      padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
      border-bottom: 1px solid var(--color-border, #dee2e6);
      line-height: var(--line-height-relaxed, 1.6); }
    .kbt-item:last-child { border-bottom: none; }
    .kbt-item-label { flex: 0 0 8.5rem; font-weight: 600;
      color: var(--color-text-secondary, #495057); }
    .kbt-item-text { flex: 1 1 auto; }
    .kbt-item-text .kbt-kbd { font-family: var(--font-family-mono, monospace);
      background: var(--color-surface, #f8f9fa); border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-sm, 4px); padding: 2px 6px; }
    .kbt-item--active,
    .kbt-item:focus, .kbt-item:focus-visible { background: var(--color-info-background, #cff4fc);
      outline: 3px solid var(--color-focus, #0066cc); outline-offset: -3px; }
    .kbt-item--try .kbt-item-text { font-weight: 600; }
    .kbt-explore-hint { margin: 0 0 var(--spacing-sm, 8px);
      font-size: var(--font-size-sm, 0.875rem); color: var(--color-text-secondary, #6c757d); }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export class KeyboardTrainer {
  /**
   * @param {object} [options]
   * @param {string} [options.profile] - Profile id for progress scoping.
   * @param {string} [options.verbosity] - One of 'terse' | 'default' | 'novice'.
   */
  constructor(options = {}) {
    this.profile = options.profile || 'default';
    this.verbosity = options.verbosity || VERBOSITY.DEFAULT;

    // Optional live adapter (see blockly-live-adapter.js). When present and
    // available, live-capable steps drive the real editor; otherwise the
    // trainer falls back to rehearsal mode.
    this.live = options.live || null;

    this.tracks = KEYBOARD_TRACKS;
    this.trackIndex = 0;
    this.shortcutIndex = 0;

    // Which screen the dialog is showing: the searchable 'front' door (opening
    // index) or a per-move 'card'. Jumping from the front door sets this to
    // 'card'; the "All moves" control sends it back to 'front'.
    this.view = 'front';
    this._searchActiveId = null;
    // Where the learner was when they pressed "/" to jump to search, so Escape
    // can return them there instead of closing the trainer. Set by focusSearch,
    // consumed by _exitSearch, cleared whenever they commit to a move.
    this._searchReturn = null;
    // Search has two modes. While TYPING, focus is in the text box and W/S must
    // type letters. After Escape with results showing, the learner steps INTO the
    // list ("explore mode"): focus moves to the listbox and W/S (plus the arrow
    // keys) walk the matches, because they are no longer in a text field. This
    // flag tracks which mode we are in. `_searchNoMatchAcked` lets a no-result
    // query take two Escapes to close (first announces "no match", second closes).
    this._searchExplore = false;
    this._searchNoMatchAcked = false;

    this.overlay = null;
    this.removeTrap = null;
    this.isOpen = false;
    this.isListening = false;
    this.listenTimer = null;
    this.onListenKeydown = null;

    // Live-coach state.
    this.coachActive = false;
    this.liveActions = null;
    this.liveIndex = 0;
    this.liveBusy = false;
    this.onLiveKeydown = null;
    this.liveTimer = null;
    this.livePollTimer = null;
    this.cueTimer = null;
    this._cursorBaseline = null;
    // Serialized-workspace snapshot taken when a `workspaceChanged` step is
    // prompted, so we can tell when an edit actually altered the program.
    this._wsBaseline = null;
    // Timestamp of the last bare Escape, for the double-Escape close.
    this._lastEscape = 0;

    this.onLaunchHotkey = null;

    this.mastered = this._loadMastered();
  }

  _isLiveStep(sc) {
    return !!(sc.live && this.live && this.live.available);
  }

  _loadMastered() {
    const saved = loadProgress(PROGRESS_MODE, this.profile);
    return new Set(saved && Array.isArray(saved.mastered) ? saved.mastered : []);
  }

  _persistMastered() {
    saveProgress(PROGRESS_MODE, { mastered: Array.from(this.mastered) }, this.profile);
  }

  get currentTrack() {
    return this.tracks[this.trackIndex];
  }

  get currentShortcut() {
    return this.currentTrack.shortcuts[this.shortcutIndex];
  }

  // ---- lifecycle -----------------------------------------------------------

  open() {
    if (this.isOpen) return;
    injectStyles();

    this.overlay = this._createOverlay();
    document.body.appendChild(this.overlay);

    // The dialog is aria-modal, which makes screen readers ignore any live region
    // OUTSIDE it. announce()'s regions live on <body>, so move them inside the
    // overlay for the duration — otherwise none of the trainer's spoken lines
    // (arrival, step-by-step, "press X now", "Correct!") reach the screen reader.
    this._attachLiveRegions();

    pushFocus(this.overlay);
    this.isOpen = true;
    this._lastEscape = 0;
    this.view = 'front';
    this._searchReturn = null;
    // No curated scene is laid yet; the first move to render lays its own.
    this._loadedScene = null;

    // Load the shared practice program once, up front. The keyboard tutorial is
    // its own segment with its own program: stashing the learner's own blocks
    // (restored on close) and laying down a small practice stack means every move
    // the learner jumps to from the front door already has something concrete to
    // act on and describe — even if they arrived with an empty canvas.
    if (this.live && this.live.available && this.live.loadSandbox) {
      this.live.loadSandbox();
    }

    const total = getAllShortcuts().length;
    // Front-door orientation: terse, audio-first. The full "what's on the
    // workspace" description and the keyboard-nav enabling ritual are deferred to
    // the moment the learner actually lands on a move (orientation-on-arrival)
    // and starts live practice, so the front door stays a quick menu.
    announce(
      `Keyboard trainer. ${this.mastered.size} of ${total} moves practiced. ` +
      'Start from the beginning, or search for a move by name, concept, or key ' +
      'and jump straight to it. Press Escape twice to leave.'
    );
    this._renderFrontDoor();
  }

  close() {
    if (!this.isOpen) return;
    this._stopListening();
    this._stopLive();
    this._removeCue();
    // Hand the learner's own blocks back if we were in the practice sandbox.
    if (this.live && this.live.restoreSandbox) this.live.restoreSandbox();
    this._loadedScene = null;
    if (this.removeTrap) { this.removeTrap(); this.removeTrap = null; }
    popFocus();
    // Put the live regions back on <body> BEFORE removing the overlay, or they
    // would be destroyed with it and announce() would go silent everywhere.
    this._detachLiveRegions();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.isOpen = false;
    announce('Keyboard trainer closed.');
  }

  // Move announce()'s shared live regions into / out of the modal overlay. While
  // the dialog is aria-modal, only live regions inside it are spoken; on close we
  // restore them to <body> so the rest of the app keeps hearing announcements.
  _attachLiveRegions() {
    initLiveRegion(); // ensure the regions exist
    ['sr-live-polite', 'sr-live-assertive'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && this.overlay) this.overlay.appendChild(el);
    });
  }

  _detachLiveRegions() {
    ['sr-live-polite', 'sr-live-assertive'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) document.body.appendChild(el);
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  dispose() {
    this.disableLaunchHotkey();
    this.close();
  }

  // ---- launch hotkey -------------------------------------------------------

  /**
   * Register a global key to open the trainer, so users don't have to Tab
   * across the page to reach the launch button. Defaults to "?" (Shift+/),
   * the universal "help" convention, which is unbound in the plugin (its
   * plain-slash shortcuts all require no modifiers or Ctrl/Cmd, so Shift+/
   * never collides).
   *
   * The handler is inert while focus is in a text field, and only ever opens
   * (never toggles closed) so a stray "?" during live practice can't dismiss
   * the trainer — Escape remains the way out.
   *
   * @param {object} [opts]
   * @param {(e: KeyboardEvent) => boolean} [opts.match] - Custom matcher.
   *   Defaults to matching the "?" character.
   */
  enableLaunchHotkey(opts = {}) {
    if (this.onLaunchHotkey) return;
    const match = typeof opts.match === 'function'
      ? opts.match
      : (e) => e.key === '?';
    this.onLaunchHotkey = (e) => {
      if (this.isOpen) return;
      if (this._isEditableTarget(e.target)) return;
      if (!match(e)) return;
      e.preventDefault();
      this.open();
    };
    document.addEventListener('keydown', this.onLaunchHotkey, true);
  }

  disableLaunchHotkey() {
    if (!this.onLaunchHotkey) return;
    document.removeEventListener('keydown', this.onLaunchHotkey, true);
    this.onLaunchHotkey = null;
  }

  _isEditableTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return !!el.isContentEditable;
  }

  // ---- DOM -----------------------------------------------------------------

  _createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'kbt-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'kbt-title');

    const dialog = document.createElement('div');
    dialog.className = 'kbt-dialog';
    dialog.id = 'kbt-dialog-body';
    overlay.appendChild(dialog);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !this.isListening && !this.coachActive) this.close();
    });
    overlay.addEventListener('keydown', (e) => {
      // Bare "/" jumps focus to the search box — the near-universal "focus search"
      // convention (the plugin itself opens its shortcut search with "/"). It is
      // guarded three ways: it ignores "/" typed INTO an editable field (so the
      // search box itself accepts a literal slash), it carries no modifier (so the
      // plugin's Ctrl+/ comment toggle is untouched), and it only fires while the
      // dialog is the modal front door / card. During live coach the dialog is
      // non-modal and the workspace holds focus, so this handler never sees the
      // key and the plugin's own "/" search is left to work as usual.
      if (
        (e.key === '/' || e.code === 'Slash') &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        !this._isEditableTarget(e.target) &&
        !this.isListening && !this.coachActive
      ) {
        e.preventDefault();
        e.stopPropagation();
        this.focusSearch();
        return;
      }
      // Card view: W/S and the arrows step through the lesson item list,
      // self-voicing each row — the same motion the editor track teaches, reused
      // so a learner can explore the lesson at their own pace. Inert while
      // practising (listening / live coach), and never steals keys from a field.
      if (
        this.view === 'card' && !this.isListening && !this.coachActive &&
        !this._isEditableTarget(e.target)
      ) {
        const k = e.key;
        const back = k === 'ArrowUp' || k === 'w' || k === 'W';
        const fwd = k === 'ArrowDown' || k === 's' || k === 'S';
        if (back || fwd) {
          e.preventDefault();
          this._stepCardItem(fwd ? 1 : -1);
          return;
        }
      }
      // Escape closes the trainer, except while rehearsing or coaching live —
      // in those modes Escape may itself be the shortcut under practice. Because
      // Escape is also a real editor key the learner practices (close the
      // toolbox, leave Edit mode), closing takes TWO presses within 600 ms, so a
      // single practice Escape never dismisses the tutorial by accident.
      if (e.key === 'Escape' && !this.isListening && !this.coachActive) {
        e.preventDefault();
        const now = Date.now();
        if (now - this._lastEscape < 600) {
          this._lastEscape = 0;
          this.close();
        } else {
          this._lastEscape = now;
          announce('Press Escape again to close the trainer.');
        }
      }
    });

    return overlay;
  }

  // ---- front door (searchable index) ---------------------------------------
  //
  // The trainer opens here, not on a move. A learner can start from the
  // beginning, search for a move by name / concept / key and jump to it, or
  // browse the full list. Built on searchShortcuts() (see keyboard-tracks.js),
  // which is forgiving enough that "nest" surfaces both F (in) and Q (out).

  _renderFrontDoor() {
    if (!this.overlay) return;
    this.view = 'front';
    this.overlay.classList.remove('kbt-overlay--coach');
    this.overlay.setAttribute('aria-modal', 'true');
    const dialog = this.overlay.querySelector('.kbt-dialog');
    dialog.innerHTML = '';

    const total = getAllShortcuts().length;

    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.id = 'kbt-title';
    title.style.cssText = 'margin:0;font-size:var(--font-size-2xl,1.5rem);';
    title.textContent = 'Keyboard trainer';
    header.appendChild(title);
    const sub = document.createElement('p');
    sub.style.cssText = 'margin:var(--spacing-xs,4px) 0 0;color:var(--color-text-secondary,#6c757d);';
    sub.textContent = `${this.mastered.size} of ${total} moves practiced. Pick where to begin.`;
    header.appendChild(sub);
    dialog.appendChild(header);

    const startBtn = this._button('Start from the beginning', 'kbt-btn kbt-btn-primary');
    startBtn.style.cssText = 'margin:var(--spacing-lg,24px) 0;';
    startBtn.addEventListener('click', () => {
      this.trackIndex = 0;
      this.shortcutIndex = 0;
      this.view = 'card';
      this._render({ orient: true });
    });
    dialog.appendChild(startBtn);

    dialog.appendChild(this._buildSearch());
    dialog.appendChild(this._buildIndex());

    const footer = document.createElement('p');
    footer.style.cssText =
      'margin:var(--spacing-lg,24px) 0 0;font-size:var(--font-size-sm,0.875rem);' +
      'color:var(--color-text-secondary,#6c757d);';
    footer.textContent =
      'Tip: press the Slash key any time in the trainer to jump to search. ' +
      'Press Escape twice to close.';
    dialog.appendChild(footer);

    if (this.removeTrap) { this.removeTrap(); }
    this.removeTrap = trapFocus(dialog);
  }

  _buildSearch() {
    const wrap = document.createElement('section');
    wrap.setAttribute('role', 'search');
    wrap.style.cssText = 'margin:var(--spacing-lg,24px) 0;';

    const label = document.createElement('label');
    label.id = 'kbt-search-label';
    label.setAttribute('for', 'kbt-search');
    label.style.cssText = 'display:block;font-weight:600;margin-bottom:var(--spacing-xs,4px);';
    label.textContent = 'Search moves by name, concept, or key';
    wrap.appendChild(label);

    const input = document.createElement('input');
    input.id = 'kbt-search';
    input.type = 'text';
    input.className = 'kbt-search-input';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'kbt-results');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-activedescendant', '');
    input.setAttribute('aria-describedby', 'kbt-search-hint');
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'Try: nesting, delete, run, F';
    wrap.appendChild(input);

    const hint = document.createElement('p');
    hint.id = 'kbt-search-hint';
    hint.style.cssText =
      'margin:var(--spacing-xs,4px) 0 0;font-size:var(--font-size-sm,0.875rem);' +
      'color:var(--color-text-secondary,#6c757d);';
    hint.textContent =
      'Type part of a word. When matches appear, press Enter to step into the ' +
      'list, then use W and S — or the Down and Up arrows — to move through them, ' +
      'and Enter again to open one. Press Escape to leave search.';
    wrap.appendChild(hint);

    // Screen-reader-only live region: announces the match count as the learner
    // types, without stealing focus from the input (ARIA combobox pattern).
    const status = document.createElement('div');
    status.id = 'kbt-search-status';
    status.className = 'kbt-sr-only';
    status.setAttribute('role', 'status');
    wrap.appendChild(status);

    const list = document.createElement('ul');
    list.id = 'kbt-results';
    list.className = 'kbt-listbox';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Matching moves');
    wrap.appendChild(list);

    this._searchActiveId = null;
    input.addEventListener('input', () => this._runSearch(input.value));
    input.addEventListener('keydown', (e) => this._onSearchKeydown(e));
    // Explore mode keys live on the list itself: once focus is here (after the
    // learner presses Escape with matches showing), W/S and the arrows walk the
    // results without the text box swallowing them.
    list.addEventListener('keydown', (e) => this._onExploreKeydown(e));
    return wrap;
  }

  _buildIndex() {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'All moves');
    nav.style.cssText = 'margin-top:var(--spacing-md,16px);';

    const heading = document.createElement('h3');
    heading.style.cssText = 'margin:0 0 var(--spacing-xs,4px);font-size:var(--font-size-lg,1.125rem);';
    heading.textContent = 'Or browse every move';
    nav.appendChild(heading);

    const hint = document.createElement('p');
    hint.className = 'kbt-explore-hint';
    hint.textContent =
      'Tab into the list, then use W and S or the arrows to move through every ' +
      'move one by one, and Enter to open one.';
    nav.appendChild(hint);

    // One flat list of buttons across both tracks for roving-tabindex navigation:
    // a single focusable element at a time, W/S + arrows walk between them, and
    // focusing each lets the screen reader read it — the same explore motion as
    // the card and the search results, applied to the whole catalogue.
    const buttons = [];
    this.tracks.forEach((track) => {
      const group = document.createElement('section');
      const h = document.createElement('h4');
      h.style.cssText = 'margin:var(--spacing-md,16px) 0 var(--spacing-xs,4px);font-size:var(--font-size-base,1rem);';
      h.textContent = track.title;
      group.appendChild(h);

      const ul = document.createElement('ul');
      ul.className = 'kbt-index-list';
      track.shortcuts.forEach((sc) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kbt-index-item';
        btn.tabIndex = -1; // roving; the first button is promoted to 0 below
        btn.dataset.id = sc.id;
        const done = this.mastered.has(sc.id) ? ' (practiced)' : '';
        // Concept-first: the move's plain-language name leads, the key follows.
        btn.innerHTML =
          `${sc.label}<span class="kbt-index-key">: ${sc.keyHint}</span>${done}`;
        btn.setAttribute(
          'aria-label',
          `${sc.label}, key ${sc.keyHint}${done}. Press Enter to open this move.`
        );
        btn.addEventListener('click', () => this.goToShortcut(sc.id));
        li.appendChild(btn);
        ul.appendChild(li);
        buttons.push(btn);
      });
      group.appendChild(ul);
      nav.appendChild(group);
    });
    if (buttons[0]) buttons[0].tabIndex = 0;

    nav.addEventListener('keydown', (e) => {
      const k = e.key;
      const back = k === 'ArrowUp' || k === 'w' || k === 'W';
      const fwd = k === 'ArrowDown' || k === 's' || k === 'S';
      if (!back && !fwd) return;
      e.preventDefault();
      const cur = buttons.indexOf(document.activeElement);
      const idx = cur < 0 ? 0 : (cur + (fwd ? 1 : -1) + buttons.length) % buttons.length;
      buttons.forEach((b, i) => { b.tabIndex = i === idx ? 0 : -1; });
      buttons[idx].focus(); // moving focus lets the screen reader read the move
    });

    return nav;
  }

  _runSearch(value) {
    if (!this.overlay) return;
    const list = this.overlay.querySelector('#kbt-results');
    const input = this.overlay.querySelector('#kbt-search');
    const status = this.overlay.querySelector('#kbt-search-status');
    if (!list || !input) return;
    // Any edit to the query is a fresh start: leave explore mode and clear the
    // no-match acknowledgement so Escape staging restarts cleanly.
    this._searchExplore = false;
    this._searchNoMatchAcked = false;
    list.innerHTML = '';
    const q = (value || '').trim();

    if (!q) {
      input.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-activedescendant', '');
      this._searchActiveId = null;
      if (status) status.textContent = '';
      return;
    }

    const results = searchShortcuts(q);

    if (!results.length) {
      input.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-activedescendant', '');
      this._searchActiveId = null;
      if (status) status.textContent = `No moves match ${q}.`;
      const li = document.createElement('li');
      li.className = 'kbt-option kbt-option--empty';
      li.textContent =
        `No moves match “${q}”. Try a different word — like “nesting”, “delete”, ` +
        'or a single key such as F.';
      list.appendChild(li);
      return;
    }

    results.forEach((sc) => {
      const track = this.tracks.find((t) => t.id === sc.trackId);
      const done = this.mastered.has(sc.id) ? ' · practiced' : '';
      const li = document.createElement('li');
      li.id = `kbt-opt-${sc.id}`;
      li.className = 'kbt-option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.id = sc.id;
      li.innerHTML =
        `<span class="kbt-option-label">${sc.label}</span>` +
        `<span class="kbt-option-key">: ${sc.keyHint}</span>` +
        `<span class="kbt-option-track"> · ${track ? track.title : ''}${done}</span>`;
      // mousedown (not click) so selecting does not first blur the input.
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.goToShortcut(sc.id);
      });
      list.appendChild(li);
    });

    input.setAttribute('aria-expanded', 'true');
    if (status) {
      const n = results.length;
      status.textContent =
        `${n} ${n === 1 ? 'move matches' : 'moves match'}. ` +
        'Press Enter to step into the list and move through with W and S.';
    }
    this._setActiveOption(results[0].id);
  }

  _setActiveOption(id) {
    if (!this.overlay) return;
    const list = this.overlay.querySelector('#kbt-results');
    const input = this.overlay.querySelector('#kbt-search');
    if (!list || !input) return;
    list.querySelectorAll('.kbt-option[role="option"]').forEach((el) => {
      const on = el.dataset.id === id;
      el.classList.toggle('kbt-option--active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    this._searchActiveId = id || null;
    input.setAttribute('aria-activedescendant', id ? `kbt-opt-${id}` : '');
    const active = id ? list.querySelector(`#kbt-opt-${id}`) : null;
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  _onSearchKeydown(e) {
    if (!this.overlay) return;
    const list = this.overlay.querySelector('#kbt-results');
    const options = list
      ? Array.from(list.querySelectorAll('.kbt-option[role="option"]'))
      : [];

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return;
      e.preventDefault();
      const idx = options.findIndex((o) => o.dataset.id === this._searchActiveId);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = options[(idx + delta + options.length) % options.length];
      this._setActiveOption(next.dataset.id);
    } else if (e.key === 'Enter') {
      // Enter steps INTO the results list to explore with W/S, rather than
      // jumping straight to the first match — so a learner who searched "nest"
      // (which surfaces both F and Q) can choose which one. A second Enter, now
      // inside the list, opens the highlighted move. (See _onExploreKeydown.)
      if (options.length) {
        e.preventDefault();
        this._enterExplore();
      }
    } else if (e.key === 'Escape') {
      // Escape backs OUT of search (Enter is now the "step into the list" key, so
      // Escape stays a consistent "leave" everywhere). stopPropagation keeps it
      // off the overlay's double-Escape close handler.
      //   • empty / has matches → leave search straight away.
      //   • query, no match     → first Escape says "no match", second leaves.
      e.preventDefault();
      e.stopPropagation();
      const q = (this.overlay.querySelector('#kbt-search').value || '').trim();
      if (!q) {
        this._exitSearch();
      } else if (options.length) {
        this._exitSearch();
      } else if (this._searchNoMatchAcked) {
        this._exitSearch();
      } else {
        this._searchNoMatchAcked = true;
        announce(
          `There is no match with your search for ${q}. Press Escape again to ` +
          'close search, or change your word.',
          { assertive: true }
        );
      }
    }
  }

  // Step the learner from the text box INTO the results list. Focus moves to the
  // listbox (made programmatically focusable), so W/S and the arrows now walk the
  // matches instead of typing into the box. Announces the count, the controls,
  // and the first result so a BVI learner knows how many there are and how to
  // move. No-op when there is nothing to explore.
  _enterExplore() {
    const list = this.overlay && this.overlay.querySelector('#kbt-results');
    if (!list) return;
    const options = Array.from(list.querySelectorAll('.kbt-option[role="option"]'));
    if (!options.length) return;
    this._searchExplore = true;
    list.setAttribute('tabindex', '-1');
    let idx = options.findIndex((o) => o.dataset.id === this._searchActiveId);
    if (idx < 0) idx = 0;
    this._setActiveOption(options[idx].dataset.id);
    if (list.focus) list.focus();
    const n = options.length;
    announce(
      `Exploring ${n} result${n === 1 ? '' : 's'}. ` +
      'Press W or the Down arrow to move forward, S or Up to move back, ' +
      'Enter to open a move, Escape to leave search. ' +
      `Result ${idx + 1} of ${n}: ${this._optionSpeech(options[idx].dataset.id)}.`,
      { assertive: true }
    );
  }

  // Keys while exploring the results list. W/S mirror the editor's own up/down so
  // the learner uses the same motion they are being taught; the arrows work too.
  _onExploreKeydown(e) {
    if (!this._searchExplore) return;
    const list = this.overlay && this.overlay.querySelector('#kbt-results');
    if (!list) return;
    const options = Array.from(list.querySelectorAll('.kbt-option[role="option"]'));
    if (!options.length) return;
    const key = e.key;
    const fwd = key === 'ArrowDown' || key === 'w' || key === 'W';
    const back = key === 'ArrowUp' || key === 's' || key === 'S';
    if (fwd || back) {
      e.preventDefault();
      let idx = options.findIndex((o) => o.dataset.id === this._searchActiveId);
      if (idx < 0) idx = 0;
      const next = (idx + (fwd ? 1 : -1) + options.length) % options.length;
      this._setActiveOption(options[next].dataset.id);
      const n = options.length;
      announce(
        `Result ${next + 1} of ${n}: ${this._optionSpeech(options[next].dataset.id)}.`,
        { assertive: true }
      );
    } else if (key === 'Enter') {
      e.preventDefault();
      if (this._searchActiveId) this.goToShortcut(this._searchActiveId);
    } else if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this._exitSearch();
    }
  }

  // Spoken form of a result row: its plain-language name then its key, e.g.
  // "Move a block up, Shift plus W". Looks the move up by id across both tracks.
  _optionSpeech(id) {
    for (const t of this.tracks) {
      const sc = t.shortcuts.find((s) => s.id === id);
      if (sc) return `${sc.label}, ${sc.keyHint}`;
    }
    return '';
  }

  /**
   * Jump straight to a move by id, from search or the browse list. Sets the
   * track/shortcut position, switches to the card view, and lands with an
   * orientation announcement (where you are + what's on the workspace + the move).
   * @param {string} id - Shortcut id.
   * @returns {boolean} True if the id was found and we jumped.
   */
  goToShortcut(id) {
    let ti = -1;
    let si = -1;
    for (let t = 0; t < this.tracks.length; t++) {
      const idx = this.tracks[t].shortcuts.findIndex((s) => s.id === id);
      if (idx !== -1) { ti = t; si = idx; break; }
    }
    if (ti === -1) return false;
    this._searchExplore = false;
    this._searchNoMatchAcked = false;
    this._stopListening();
    this._stopLive();
    this.trackIndex = ti;
    this.shortcutIndex = si;
    this.view = 'card';
    this._render({ orient: true });
    return true;
  }

  /**
   * Bring focus to the search box, opening the front door first if a move card
   * is showing. Wired to the bare "/" key inside the trainer.
   */
  focusSearch() {
    if (!this.isOpen) this.open();
    this._searchExplore = false;
    this._searchNoMatchAcked = false;
    // Snapshot where the learner is so Escape can bring them straight back out,
    // rather than dropping them at the front door or into the close prompt.
    this._searchReturn = this.view === 'card'
      ? { kind: 'card', t: this.trackIndex, s: this.shortcutIndex }
      : { kind: 'front' };
    if (this.view !== 'front') this._renderFrontDoor();
    const input = this.overlay && this.overlay.querySelector('#kbt-search');
    if (input) input.focus();
    announce(
      'Search moves. Type a name, concept, or key. Press Escape to go back.',
      { assertive: true }
    );
  }

  // Leave the search box and return the learner to wherever "/" was pressed: the
  // move card they were on, or the front door's Start button. Clears the query so
  // a later "/" opens fresh.
  _exitSearch() {
    this._searchExplore = false;
    this._searchNoMatchAcked = false;
    const list = this.overlay && this.overlay.querySelector('#kbt-results');
    if (list) list.removeAttribute('tabindex');
    const input = this.overlay && this.overlay.querySelector('#kbt-search');
    if (input) input.value = '';
    this._runSearch('');
    const ret = this._searchReturn;
    this._searchReturn = null;
    // Came here from a move card via "/": go straight back to that card.
    if (ret && ret.kind === 'card') {
      this.trackIndex = ret.t;
      this.shortcutIndex = ret.s;
      this.view = 'card';
      this._render();
      return;
    }
    // Otherwise land on the front door's primary button and remind the learner
    // both ways forward exist: search again, or start the ordered walkthrough.
    const startBtn = this.overlay && this.overlay.querySelector('.kbt-btn-primary');
    if (startBtn) startBtn.focus();
    announce(
      'Left search. Looking for a specific keyboard shortcut? Press the slash key ' +
      'any time to search again. Or, to learn every move in order, the Start from ' +
      'the beginning button is now selected — press Enter to begin.',
      { assertive: true }
    );
  }

  // Orientation-on-arrival: spoken when the learner JUMPS to a move (rather than
  // stepping to the next one), so a BVI learner who skipped around always knows
  // where they landed, what is on the workspace, and what this move does. Terse
  // and audio-first: position, then the program, then the move instruction.
  _orientationText(track, sc) {
    const scNum = this.shortcutIndex + 1;
    const scTotal = track.shortcuts.length;
    const parts = [`${track.title}. Move ${scNum} of ${scTotal}: ${sc.label}.`];
    if (
      track.requiresSandbox && this.live && this.live.available &&
      this.live.describeWorkspace
    ) {
      const summary = this.live.describeWorkspace();
      if (summary) parts.push(summary);
    }
    parts.push(this._instructionText(sc));
    return parts.join(' ');
  }

  // Lay the curated scene a move belongs to (see `scene` in keyboard-tracks and
  // PRACTICE_SCENES) on the real canvas, so what the learner hears described and
  // what their keypress acts on actually match. Called on every card arrival so
  // both live AND rehearsal moves get the right canvas. Re-lays only when the
  // scene id changes, except on a fresh arrival (`force`), where we re-lay pristine
  // so the orientation's block description is accurate even after an earlier
  // editing drill mutated the previous scene.
  _ensureScene(sc, force) {
    if (!this.live || !this.live.available) return;
    const scene = sc && sc.scene;
    if (scene && this.live.loadScene) {
      if (force || this._loadedScene !== scene) {
        this.live.loadScene(scene);
        this._loadedScene = scene;
      }
    }
  }

  _render(opts = {}) {
    if (!this.overlay) return;
    // _render only ever draws a move card, so the card-item explore keys (W/S)
    // are valid from here on — make that explicit regardless of caller.
    this.view = 'card';
    // Landing on a move card commits the learner here; any pending "escape back
    // to where I was" target from a search detour no longer applies.
    this._searchReturn = null;
    // If we drifted off the sandbox tracks (back to Track A, or completion),
    // hand the learner's own blocks back. Staying within sandbox tracks keeps
    // the practice stack in place so it does not flicker between drills.
    if (
      this.live && this.live.isSandboxLoaded && this.live.isSandboxLoaded() &&
      !this.currentTrack.requiresSandbox
    ) {
      this.live.restoreSandbox();
    }
    // Rendering the full card is always the modal view; clear any coach styling.
    this.overlay.classList.remove('kbt-overlay--coach');
    this.overlay.setAttribute('aria-modal', 'true');
    const dialog = this.overlay.querySelector('.kbt-dialog');
    dialog.innerHTML = '';

    const track = this.currentTrack;
    const sc = this.currentShortcut;
    // Lay this move's scene before we describe it, so the orientation and the
    // canvas agree. Force a pristine re-lay on a fresh arrival (orient).
    this._ensureScene(sc, !!opts.orient);
    const scNum = this.shortcutIndex + 1;
    const scTotal = track.shortcuts.length;
    const done = this.mastered.has(sc.id);

    // Header
    const header = document.createElement('header');
    header.style.cssText =
      'display:flex;justify-content:space-between;align-items:baseline;gap:var(--spacing-md,16px);';
    const title = document.createElement('h2');
    title.id = 'kbt-title';
    title.style.cssText = 'margin:0;font-size:var(--font-size-2xl,1.5rem);';
    title.textContent = done ? `${sc.label} (practiced)` : sc.label;
    const counter = document.createElement('span');
    counter.style.cssText = 'color:var(--color-text-secondary,#6c757d);white-space:nowrap;';
    counter.textContent = `Move ${scNum} of ${scTotal} · ${track.title}`;
    header.appendChild(title);
    header.appendChild(counter);
    dialog.appendChild(header);

    // How-to-explore hint for the stepped item list below.
    const exploreHint = document.createElement('p');
    exploreHint.className = 'kbt-explore-hint';
    exploreHint.textContent =
      'Press S or the Down arrow to step through the lesson, W or Up to go back.';
    dialog.appendChild(exploreHint);

    // The lesson is a stepped, self-voicing item list: discrete rows a learner
    // walks with W/S (or arrows), each announced on landing — instead of a
    // one-shot wall of prose. The track overview is folded in as items on the
    // first move rather than spoken as a paragraph on arrival.
    const items = this._buildCardItems(track, sc);
    const card = document.createElement('section');
    card.className = 'kbt-card';
    card.setAttribute('role', 'list');
    card.setAttribute('aria-label', 'Lesson steps');
    this._cardItems = [];
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'kbt-item' + (it.try ? ' kbt-item--try' : '');
      // Each row is a real focus target with its own accessible name, so the
      // screen reader READS it on focus — the channel that actually works inside
      // the aria-modal dialog (plain text divs are skipped by Tab and browse).
      // Roving tabindex: one Tab stop into the list, then W/S / arrows walk it.
      row.setAttribute('role', 'listitem');
      row.tabIndex = i === 0 ? 0 : -1;
      const lbl = document.createElement('div');
      lbl.className = 'kbt-item-label';
      if (it.label) lbl.textContent = it.label;
      else lbl.setAttribute('aria-hidden', 'true');
      row.appendChild(lbl);
      const txt = document.createElement('div');
      txt.className = 'kbt-item-text';
      if (it.kbd) txt.innerHTML = `<span class="kbt-kbd">${it.text}</span>`;
      else txt.textContent = it.text;
      row.appendChild(txt);
      // Spoken form: read on focus and used as the row's accessible name.
      row._speak = (it.label ? it.label + '. ' : '') + it.text;
      row.setAttribute('aria-label', `${row._speak} . Step ${i + 1} of ${items.length}.`);
      // Keep W/S in step with wherever focus actually is (e.g. arrived by Tab).
      row.addEventListener('focus', () => { this._cardIndex = i; });
      card.appendChild(row);
      this._cardItems.push(row);
    });
    this._cardIndex = -1; // first S press lands on item 0
    dialog.appendChild(card);

    // Visual status / listening line for SIGHTED users only. Deliberately NOT an
    // aria-live region: every textContent write here is mirrored by an
    // announce(..., { assertive: true }) call, and announce.js owns the
    // screen-reader channel (queued, drop-resistant). If this carried aria-live
    // too, screen readers would speak every message twice.
    const status = document.createElement('div');
    status.id = 'kbt-status';
    status.style.cssText = 'margin-top:var(--spacing-md,16px);min-height:1.5em;';
    dialog.appendChild(status);

    // Controls
    dialog.appendChild(this._buildControls(track, sc));

    // Footer hint
    const footer = document.createElement('p');
    footer.style.cssText =
      'margin:var(--spacing-lg,24px) 0 0;font-size:var(--font-size-sm,0.875rem);' +
      'color:var(--color-text-secondary,#6c757d);';
    footer.textContent = 'Press Escape twice to close the trainer. Your progress is saved automatically.';
    dialog.appendChild(footer);

    // Skip, relocated to the top-left as the FIRST focusable control (TVI
    // feedback): a learner can bypass a move without tabbing past every button.
    // It sits ahead of everything in the DOM so it is the first Tab stop; the
    // light-red styling makes it a recognizable, high-contrast target.
    const skipBar = document.createElement('div');
    skipBar.style.cssText = 'display:flex;margin:0 0 var(--spacing-md,16px);';
    const skipBtn = this._button('Skip', 'kbt-btn kbt-btn-skip');
    skipBtn.setAttribute('aria-label', 'Skip this move');
    skipBtn.addEventListener('click', () => this._advance(false));
    skipBar.appendChild(skipBtn);
    dialog.insertBefore(skipBar, dialog.firstChild);

    // Focus + trap
    if (this.removeTrap) { this.removeTrap(); }
    this.removeTrap = trapFocus(dialog);

    // trapFocus lands on the first focusable element — which is now Skip. We
    // don't want every move to auto-focus "Skip" (it reads as if the tool is
    // nudging the learner away), so move initial focus to the primary action.
    // Skip remains the first TAB STOP, one Shift+Tab away.
    if (this._primaryBtn && !this._primaryBtn.disabled) {
      this._primaryBtn.focus();
    }

    // Announce on render. A normal step-to-step move gets a short lead (name +
    // keys); a JUMP (from the front door / search) gets the fuller orientation —
    // where you are, what's on the workspace, and the move. Either way we point
    // the learner at the two controls now: step the lesson, or practice.
    const lead = opts.orient
      ? this._orientationText(track, sc)
      : `${sc.label}. Keys: ${sc.keyHint}.`;
    announce(`${lead} Press S to step through the lesson, or Try it to practice.`);
  }

  _instructionText(sc) {
    if (this.verbosity === VERBOSITY.TERSE) {
      return `${sc.label}. Keys: ${sc.keyHint}.`;
    }
    if (this.verbosity === VERBOSITY.NOVICE) {
      const detail = canonicalDetail(sc.helpRow);
      return detail ? `${sc.instruction} ${detail}` : sc.instruction;
    }
    return sc.instruction;
  }

  // Break prose into sentence-sized chunks so each becomes its own explorable,
  // self-voiced item. Keeps key names like "Control plus Shift plus K" intact
  // (they carry no sentence-ending punctuation).
  _splitSentences(text) {
    if (!text) return [];
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // The actionable cue shown as the "Try this" row, tying the lesson to the
  // Try it control the learner uses to actually practise.
  _tryText(sc) {
    if (sc.infoOnly) {
      return 'This one you practise on the real workspace, not inside the trainer.';
    }
    const prompt = this._currentPrompt(sc); // e.g. "Press Control plus Shift plus K now."
    return `Choose Try it, then ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
  }

  // Decompose a move into the discrete, labelled rows the card walks the learner
  // through. Derived entirely from existing move data — no per-move rewriting.
  _buildCardItems(track, sc) {
    const items = [];
    // First move of a track: fold the track overview in as stepped items rather
    // than speaking a paragraph on arrival.
    if (this.shortcutIndex === 0 && track.description) {
      this._splitSentences(track.description).forEach((s, i) => {
        items.push({ label: i === 0 ? `About ${track.title}` : '', text: s });
      });
    }
    items.push({ label: 'Move', text: sc.label });
    items.push({ label: 'Keys', text: sc.keyHint, kbd: true });
    this._splitSentences(this._instructionText(sc)).forEach((s, i) => {
      items.push({ label: i === 0 ? 'What it does' : '', text: s });
    });
    items.push({ label: 'Try this', text: this._tryText(sc), try: true });
    return items;
  }

  // Walk the lesson rows. W / Up = previous, S / Down = next — the same motion
  // the editor track teaches. We move REAL focus to the row (roving tabindex):
  // the screen reader then reads it on focus, which is the reliable channel
  // inside an aria-modal dialog (no dependence on a live region firing).
  _stepCardItem(delta) {
    const rows = this._cardItems;
    if (!rows || !rows.length) return;
    const n = rows.length;
    if (this._cardIndex >= 0 && rows[this._cardIndex]) {
      rows[this._cardIndex].classList.remove('kbt-item--active');
      rows[this._cardIndex].removeAttribute('aria-current');
    }
    this._cardIndex = (this._cardIndex + delta + n) % n;
    rows.forEach((r, i) => { r.tabIndex = i === this._cardIndex ? 0 : -1; });
    const row = rows[this._cardIndex];
    row.classList.add('kbt-item--active');
    row.setAttribute('aria-current', 'true');
    if (row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    row.focus(); // screen reader reads the row's accessible name on focus
  }

  _buildControls(track, sc) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--spacing-sm,8px);align-items:center;';

    // The primary action is a single STATEFUL button (per TVI feedback): it
    // invites a first attempt as "Try it", then flips to "Try again" once the
    // learner has tried this move — so the same control doubles as the
    // retry/restart affordance instead of a separate Restart button.
    const tried =
      this.mastered.has(sc.id) || (this._attempted && this._attempted.has(sc.id));
    const retryLabel = 'Try again';

    if (this._isLiveStep(sc)) {
      // Live coach: the real editor responds to the keypress.
      const liveBtn = this._button(tried ? retryLabel : 'Try it', 'kbt-btn kbt-btn-primary');
      liveBtn.addEventListener('click', () => this._startLive());
      wrap.appendChild(liveBtn);
      this._primaryBtn = liveBtn;
    } else {
      // Not a live step (no `live`, or no workspace available). Rehearsal only
      // matches the keystroke signature, so it works with or without a live
      // workspace — the only thing still gated is `infoOnly`, which is done on
      // the real workspace rather than inside the trainer.
      const tryLabel = sc.infoOnly
        ? 'Practice on the real workspace'
        : (tried ? retryLabel : 'Try it');
      const tryBtn = this._button(tryLabel, 'kbt-btn kbt-btn-primary');
      if (sc.infoOnly) {
        tryBtn.disabled = true;
        tryBtn.title = 'This step is done on the real workspace, not inside the trainer.';
        this._primaryBtn = null;
      } else {
        tryBtn.addEventListener('click', () => this._startListening());
        this._primaryBtn = tryBtn;
      }
      wrap.appendChild(tryBtn);
    }

    // Return to the searchable index so the learner can jump elsewhere. (Kept
    // for now; placement of the move search is still under review.)
    const indexBtn = this._button('Back to menu', 'kbt-btn');
    indexBtn.addEventListener('click', () => {
      this._stopListening();
      this._stopLive();
      this._renderFrontDoor();
      announce('Menu. Start from the beginning, or search to jump.', { assertive: true });
    });
    wrap.appendChild(indexBtn);

    // Spacer
    const spacer = document.createElement('span');
    spacer.style.cssText = 'flex:1 1 auto;';
    wrap.appendChild(spacer);

    const prevBtn = this._button('Previous', 'kbt-btn');
    prevBtn.disabled = this.trackIndex === 0 && this.shortcutIndex === 0;
    prevBtn.addEventListener('click', () => this._goPrevious());
    wrap.appendChild(prevBtn);

    const nextBtn = this._button('Next', 'kbt-btn');
    nextBtn.addEventListener('click', () => this._advance(false));
    wrap.appendChild(nextBtn);

    return wrap;
  }

  _button(label, className) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    return b;
  }

  // Record that the learner has tried this move, and flip the primary button
  // from "Try it" to "Try again" right away — so the same control reads as a
  // retry/restart once an attempt is underway, without a full re-render.
  _markAttempted(sc) {
    if (!sc) return;
    if (!this._attempted) this._attempted = new Set();
    this._attempted.add(sc.id);
    if (this._primaryBtn && !this._primaryBtn.disabled) {
      this._primaryBtn.textContent = 'Try again';
    }
  }

  // ---- detection -----------------------------------------------------------

  // Detect signature the learner must press right now. For a chained scenario
  // (sc.sequence) this is the current step; otherwise the single detect.
  _expectedDetect(sc) {
    return sc.sequence ? sc.sequence[this.seqStep].detect : sc.detect;
  }

  _currentPrompt(sc) {
    if (sc.sequence) return sc.sequence[this.seqStep].prompt;
    return `Press ${sc.keyHint} now.`;
  }

  _startListening() {
    if (this.isListening) return;
    const sc = this.currentShortcut;
    this._markAttempted(sc);
    this.isListening = true;
    this.seqStep = 0;

    const status = this.overlay.querySelector('#kbt-status');
    status.className = 'kbt-listening';
    const prompt = this._currentPrompt(sc);
    status.textContent = `${prompt} Press Enter to stop.`;
    announce(`${prompt} Press Enter to stop.`, { assertive: true });

    this.onListenKeydown = (e) => this._handleListenKey(e);
    document.addEventListener('keydown', this.onListenKeydown, true);
    this._armTimeout();
  }

  _armTimeout() {
    clearTimeout(this.listenTimer);
    this.listenTimer = setTimeout(() => {
      this._stopListening();
      const s = this.overlay && this.overlay.querySelector('#kbt-status');
      if (s) { s.className = ''; s.textContent = 'No key detected. Choose Try again to practice.'; }
      announce('No key detected. Choose Try again to practice.', { assertive: true });
    }, LISTEN_TIMEOUT_MS);
  }

  _handleListenKey(e) {
    // Ignore lone modifier presses.
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    const sc = this.currentShortcut;
    const expected = this._expectedDetect(sc);
    const expectedKey = expected.key;

    // Enter always cancels. Tab and Escape cancel only when they are NOT the key
    // the learner is meant to press right now.
    const isCancel =
      e.key === 'Enter' ||
      (e.key === 'Tab' && expectedKey !== 'Tab') ||
      (e.key === 'Escape' && expectedKey !== 'Escape');

    // Practice micro-mode: swallow the key so it never reaches the real plugin
    // or moves focus.
    e.preventDefault();
    e.stopPropagation();

    if (isCancel) {
      this._stopListening();
      const status = this.overlay.querySelector('#kbt-status');
      status.className = '';
      status.textContent = 'Stopped. Choose Try again to practice.';
      announce('Stopped practicing.', { assertive: true });
      return;
    }

    if (matchesShortcut(e, expected)) {
      // Chained scenario: advance through the steps, narrating each.
      if (sc.sequence && this.seqStep < sc.sequence.length - 1) {
        const done = sc.sequence[this.seqStep].done;
        this.seqStep += 1;
        const next = sc.sequence[this.seqStep].prompt;
        const status = this.overlay.querySelector('#kbt-status');
        status.textContent = `${done} ${next}`;
        announce(`${done} ${next}`, { assertive: true });
        this._armTimeout();
        return;
      }
      this._succeed(sc);
    } else {
      const prompt = this._currentPrompt(sc);
      announce(`That was not it. ${prompt} Or press Enter to stop.`, { assertive: true });
      this._armTimeout();
    }
  }

  _succeed(sc) {
    this._stopListening();
    this.mastered.add(sc.id);
    this._persistMastered();
    const status = this.overlay.querySelector('#kbt-status');
    status.className = '';
    status.textContent = `Correct. ${sc.success}`;
    announce(`Correct. ${sc.success}`, { assertive: true });
    setTimeout(() => { if (this.isOpen) this._advance(true); }, 1400);
  }

  _stopListening() {
    if (!this.isListening) return;
    this.isListening = false;
    if (this.onListenKeydown) {
      document.removeEventListener('keydown', this.onListenKeydown, true);
      this.onListenKeydown = null;
    }
    if (this.listenTimer) { clearTimeout(this.listenTimer); this.listenTimer = null; }
  }

  // ---- live coach ----------------------------------------------------------
  //
  // Unlike rehearsal (which swallows the key), live coach lets the keypress
  // reach the real plugin, then confirms success by reading real editor state
  // through the live adapter. The trainer collapses to a non-modal bar so the
  // workspace stays focused and interactive.

  // Normalise a step into an ordered list of live actions. Each action is one
  // keypress to make on the real editor, with an optional state probe to
  // confirm it and a short visual/audio cue.
  _liveActions(sc) {
    if (sc.sequence) {
      return sc.sequence.map((s) => ({
        detect: s.detect,
        prompt: s.prompt,
        done: s.done,
        confirm: s.confirm || null,
        cue: s.cue || null,
        start: s.start || null
      }));
    }
    return [{
      detect: sc.detect,
      prompt: `Press ${sc.keyHint} now, on the real editor.`,
      done: sc.success,
      confirm: (sc.live && sc.live.confirm) || null,
      cue: (sc.live && sc.live.cue) || null,
      start: (sc.live && sc.live.start) || null
    }];
  }

  _startLive() {
    if (this.coachActive || this.isListening) return;
    if (!this._isLiveStep(this.currentShortcut)) { this._startListening(); return; }

    const sc = this.currentShortcut;
    this._markAttempted(sc);
    this.coachActive = true;
    this.liveBusy = false;
    this.liveActions = this._liveActions(sc);
    this.liveIndex = 0;

    // Steps that act on a real program need blocks under the cursor: every
    // shortcut in a `requiresSandbox` track, plus individual steps elsewhere
    // (run, output, the navigational assistant) flagged `needsBlocks`. Drop in
    // the practice stack — stashing the learner's own blocks — before anything
    // else, so the keypress has something real to act on.
    const needsBlocks =
      this.currentTrack.requiresSandbox || !!(sc.live && sc.live.needsBlocks);
    if (sc.scene && this.live.loadScene) {
      // Scene-tagged move: lay this move's curated scene, pristine, for every
      // drill. loadScene stashes the learner's own blocks on first entry and
      // re-lays from scratch after that — so an earlier editing drill that moved,
      // cut, or deleted a block never leaves the next drill's start anchor
      // dangling, and an 'empty' scene correctly clears to a blank canvas.
      this.live.loadScene(sc.scene);
      this._loadedScene = sc.scene;
    } else if (needsBlocks) {
      // Back-compat (untagged moves): start from the pristine default stack.
      if (this.live.isSandboxLoaded && this.live.isSandboxLoaded()) {
        if (this.live.resetSandbox) this.live.resetSandbox();
      } else if (this.live.loadSandbox) {
        this.live.loadSandbox();
      }
    }

    // Most navigation shortcuts (toolbox, movement, run) only fire when keyboard
    // navigation is ON. If a step needs it and it is currently off, flip it on FOR
    // the learner (Option B: auto-enable) instead of walling them mid-flow and
    // demanding Ctrl+Shift+K — pressing a key that silently does nothing is a
    // dead end for someone who cannot see the canvas. We still teach Ctrl+Shift+K
    // as its own step elsewhere, so the learner learns the real switch; here we
    // just remove the friction so the drill can start. `_autoEnabledNav` makes the
    // live intro announce the change so it is never a silent surprise.
    // The Ctrl+Shift+K drill teaches the master switch, so it must start from the
    // OFF state for the learner's keypress to have something real to turn on. The
    // trainer otherwise keeps keyboard nav on so earlier drills work, so here we
    // deliberately flip it off first; the learner's own keypress flips it back on
    // and the keyboardNavOn probe confirms the genuine toggle.
    if (sc.live && sc.live.disableNavFirst && this.live.disableKeyboardNav) {
      this.live.disableKeyboardNav();
    }

    this._autoEnabledNav = false;
    if (sc.live && sc.live.requiresKeyboardNav && !this.live.probe('keyboardNavOn')) {
      const enabled =
        this.live.enableKeyboardNav && this.live.enableKeyboardNav();
      if (enabled) {
        this._autoEnabledNav = true;
      } else {
        // Fallback: no reachable controller (e.g. older boot) — fall back to the
        // explicit master-switch step so the learner is never stuck.
        this.liveActions.unshift({
          detect: { code: 'KeyK', shift: true, ctrl: true },
          prompt:
            'First, keyboard navigation is off — so the next keys would do nothing. ' +
            'With the workspace focused, press Control, plus Shift, plus K to turn it ' +
            'on. Use Control even on a Mac, not Command.',
          done: 'Keyboard navigation on. Now for the step.',
          confirm: 'keyboardNavOn',
          cue: 'Keyboard navigation ON — a marker is now blinking on the workspace, and you control the editor.'
        });
      }
    }

    this._enterCoachMode();
    this.live.focusWorkspace();

    this.onLiveKeydown = (e) => this._handleLiveKey(e);
    document.addEventListener('keydown', this.onLiveKeydown, true);

    // For BVI learners who cannot see the canvas, describe what is on the
    // workspace before asking them to act on it.
    let context = '';
    if (needsBlocks && this.live.describeWorkspace) {
      context = this.live.describeWorkspace();
    }
    // If we flipped keyboard navigation on for them, say so up front — a marker
    // has just appeared on the canvas and they now drive the editor, which a BVI
    // learner has no other way to know.
    const navNote = this._autoEnabledNav
      ? 'I have switched the editor into keyboard mode for you — a marker is now ' +
        'on the canvas, and your keypresses control the editor. '
      : '';
    announce(
      'Live practice. Your keypresses now reach the real editor. ' +
      navNote +
      (context ? context + ' ' : '') +
      'Choose Stop to leave practice.',
      { assertive: true }
    );
    this._promptLive();
  }

  _enterCoachMode() {
    if (this.removeTrap) { this.removeTrap(); this.removeTrap = null; }
    this.overlay.classList.add('kbt-overlay--coach');
    this.overlay.setAttribute('aria-modal', 'false');
    // Swap the primary control to a Stop affordance for this session.
    const primary = this.overlay.querySelector('.kbt-btn-primary');
    if (primary) {
      primary.textContent = 'Stop live practice';
      primary.onclick = null;
      const stop = primary.cloneNode(true);
      primary.parentNode.replaceChild(stop, primary);
      stop.addEventListener('click', () => {
        this._stopLive();
        const status = this.overlay && this.overlay.querySelector('#kbt-status');
        if (status) { status.className = ''; status.textContent = 'Left live practice.'; }
        announce('Left live practice.', { assertive: true });
      });
    }
  }


  // Whether an action's confirmation condition is currently satisfied. Most
  // confirms are boolean state probes; `cursorMoved` is special — it passes
  // when the cursor has left the spot it was on when this action was prompted.
  _confirmSatisfied(action) {
    if (!action.confirm) return false;
    if (action.confirm === 'cursorMoved') {
      const sig = this.live.cursorSignature ? this.live.cursorSignature() : null;
      return sig !== null && sig !== this._cursorBaseline;
    }
    // `workspaceChanged` passes when the serialized program differs from the
    // snapshot taken when this action was prompted — i.e. the edit landed.
    if (action.confirm === 'workspaceChanged') {
      const sig = this.live.workspaceSignature ? this.live.workspaceSignature() : null;
      return sig !== null && sig !== this._wsBaseline;
    }
    return this.live.probe(action.confirm);
  }

  _promptLive() {
    if (!this.coachActive) return;
    const action = this.liveActions[this.liveIndex];
    const status = this.overlay.querySelector('#kbt-status');

    // Park the cursor on the drill's start block (movement steps), then snapshot
    // where it is so `cursorMoved` can tell when the learner's key moved it.
    if (action.start && this.live.placeCursor) this.live.placeCursor(action.start);
    if (action.confirm === 'cursorMoved') {
      this._cursorBaseline = this.live.cursorSignature ? this.live.cursorSignature() : null;
    }
    if (action.confirm === 'workspaceChanged') {
      // Snapshot the program AFTER parking the cursor (parking does not edit the
      // program), so the only thing that can change the snapshot is the edit key.
      this._wsBaseline = this.live.workspaceSignature ? this.live.workspaceSignature() : null;
    }

    // If the editor is already in the target state, acknowledge and move on so
    // the learner is never asked to do something already done.
    if (this._confirmSatisfied(action)) {
      this.liveBusy = true;
      if (status) { status.className = ''; status.textContent = action.cue || 'Already done.'; }
      announce(action.cue || 'Already done.', { assertive: true });
      this.livePollTimer = setTimeout(() => this._liveActionPassed(action), 900);
      return;
    }

    this.liveBusy = false;
    if (status) { status.className = 'kbt-listening'; status.textContent = action.prompt; }
    announce(action.prompt, { assertive: true });
    this._armLiveTimeout();
  }

  _armLiveTimeout() {
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => {
      if (!this.coachActive) return;
      const action = this.liveActions[this.liveIndex];
      announce(`Still waiting. ${action.prompt} Or choose Stop to leave practice.`, { assertive: true });
      this._armLiveTimeout();
    }, 15000);
  }

  _handleLiveKey(e) {
    if (!this.coachActive || this.liveBusy) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    const action = this.liveActions[this.liveIndex];
    if (!matchesShortcut(e, action.detect)) return;
    // Deliberately NOT preventing default: the real plugin must act on this key.
    this.liveBusy = true;
    clearTimeout(this.liveTimer);
    this._confirmLive(action);
  }

  _confirmLive(action) {
    // No probe for this action: trust the keypress (the real plugin already
    // acted) and pass after a brief beat.
    if (!action.confirm) {
      this.livePollTimer = setTimeout(() => this._liveActionPassed(action), 250);
      return;
    }
    const deadline = Date.now() + 1800;
    const poll = () => {
      if (!this.coachActive) return;
      if (this._confirmSatisfied(action)) { this._liveActionPassed(action); return; }
      if (Date.now() > deadline) {
        this.liveBusy = false;
        const status = this.overlay && this.overlay.querySelector('#kbt-status');
        if (status) status.textContent = `Did not detect the change. ${action.prompt}`;
        announce(`I did not detect the editor change. ${action.prompt}`, { assertive: true });
        this._armLiveTimeout();
        return;
      }
      this.livePollTimer = setTimeout(poll, 90);
    };
    poll();
  }

  _liveActionPassed(action) {
    if (!this.coachActive) return;
    // Movement drills have no fixed cue — describe where the cursor landed.
    let cue = action.cue;
    if (!cue && action.confirm === 'cursorMoved' && this.live.cursorDescription) {
      cue = `Cursor moved — you are now on ${this.live.cursorDescription()}.`;
    }
    if (cue) this._showCue(cue);

    if (this.liveIndex < this.liveActions.length - 1) {
      if (action.done) announce(action.done, { assertive: true });
      this.liveIndex += 1;
      this._promptLive();
      return;
    }

    // Whole scenario complete. Tear down the live listeners but leave the coach
    // bar showing the success line; _advance re-renders to the next card.
    const sc = this.currentShortcut;
    this.mastered.add(sc.id);
    this._persistMastered();
    this._teardownLive();
    const status = this.overlay && this.overlay.querySelector('#kbt-status');
    if (status) { status.className = ''; status.textContent = `Correct. ${sc.success}`; }
    announce(`Correct. ${sc.success}`, { assertive: true });
    setTimeout(() => { if (this.isOpen) this._advance(true); }, 1600);
  }

  // Tear down live listeners/timers without touching the DOM. The coach bar
  // styling is reset by the next _render() (see top of _render).
  _teardownLive() {
    this.coachActive = false;
    this.liveBusy = false;
    if (this.onLiveKeydown) {
      document.removeEventListener('keydown', this.onLiveKeydown, true);
      this.onLiveKeydown = null;
    }
    clearTimeout(this.liveTimer); this.liveTimer = null;
    clearTimeout(this.livePollTimer); this.livePollTimer = null;
  }

  _stopLive() {
    const wasActive = this.coachActive;
    this._teardownLive();
    // Manual stop (not a completion): rebuild the normal card immediately.
    if (wasActive && this.isOpen) this._render();
  }

  _showCue(text) {
    let cue = document.getElementById('kbt-cue');
    if (!cue) {
      cue = document.createElement('div');
      cue.id = 'kbt-cue';
      cue.className = 'kbt-cue';
      cue.setAttribute('role', 'status');
      document.body.appendChild(cue);
    }
    cue.textContent = text;
    // Force reflow so re-triggering the transition works on repeat cues.
    void cue.offsetWidth;
    cue.classList.add('kbt-cue--show');
    clearTimeout(this.cueTimer);
    this.cueTimer = setTimeout(() => {
      if (cue) cue.classList.remove('kbt-cue--show');
    }, 3500);
  }

  _removeCue() {
    clearTimeout(this.cueTimer);
    const cue = document.getElementById('kbt-cue');
    if (cue && cue.parentNode) cue.parentNode.removeChild(cue);
  }

  // ---- navigation ----------------------------------------------------------

  _advance(wasMastered) {
    this._stopListening();
    this._stopLive();
    const track = this.currentTrack;

    if (this.shortcutIndex < track.shortcuts.length - 1) {
      this.shortcutIndex += 1;
    } else if (this.trackIndex < this.tracks.length - 1) {
      this.trackIndex += 1;
      this.shortcutIndex = 0;
      announce(`Track complete. Next track: ${this.currentTrack.title}.`);
    } else {
      this._renderCompletion();
      return;
    }
    this._render();
  }

  _goPrevious() {
    this._stopListening();
    this._stopLive();
    if (this.shortcutIndex > 0) {
      this.shortcutIndex -= 1;
    } else if (this.trackIndex > 0) {
      this.trackIndex -= 1;
      this.shortcutIndex = this.currentTrack.shortcuts.length - 1;
    } else {
      return;
    }
    this._render();
  }

  _renderCompletion() {
    const dialog = this.overlay.querySelector('.kbt-dialog');
    dialog.innerHTML = '';
    const total = getAllShortcuts().length;

    const h = document.createElement('h2');
    h.id = 'kbt-title';
    h.textContent = 'You reached the end of the trainer';
    dialog.appendChild(h);

    const p = document.createElement('p');
    p.style.cssText = 'line-height:var(--line-height-relaxed,1.75);';
    p.textContent =
      `You have practiced ${this.mastered.size} of ${total} shortcuts. You can ` +
      `start over to review, or close the trainer.`;
    dialog.appendChild(p);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:var(--spacing-sm,8px);margin-top:var(--spacing-lg,24px);';
    const restart = this._button('Start over', 'kbt-btn kbt-btn-primary');
    restart.addEventListener('click', () => {
      this.trackIndex = 0;
      this.shortcutIndex = 0;
      this._render();
    });
    const closeBtn = this._button('Close', 'kbt-btn');
    closeBtn.addEventListener('click', () => this.close());
    wrap.appendChild(restart);
    wrap.appendChild(closeBtn);
    dialog.appendChild(wrap);

    if (this.removeTrap) { this.removeTrap(); }
    this.removeTrap = trapFocus(dialog);
    announce(
      `Trainer complete. You practiced ${this.mastered.size} of ${total} shortcuts. ` +
      `Start over or close.`
    );
  }

  // ---- public helpers ------------------------------------------------------

  setVerbosity(level) {
    if (Object.values(VERBOSITY).includes(level)) {
      this.verbosity = level;
      if (this.isOpen) this._render();
    }
  }

  resetProgress() {
    this.mastered = new Set();
    this._persistMastered();
  }
}

export { VERBOSITY };
