// shortcut_assistance.js
import * as Constants from '../constants';
import {Speech} from '../audio/speech';

export class ShortcutAssistance {
    /**
     * @param {Speech=} speech
     */
    constructor(speech) {
        this.speech = speech || new Speech();

        this.root = null;
        this.listEl = null;
        this.items = [];
        this.index = -1;             // start with NO SELECTION
        this.isOpen = false;
        this.prevFocus = null;

        // bound
        this._onKeydownInDialog = this._onKeydownInDialog.bind(this);
        this._onClickBackdrop = this._onClickBackdrop.bind(this);
        this._onFocusInGuard = this._onFocusInGuard.bind(this);
    }

    init() {
        this._ensureDOM();
        this._ensureCSS();
    }

    dispose() {
        document.removeEventListener('keydown', this._onKeydownInDialog, true);
        this.root?.removeEventListener('focusin', this._onFocusInGuard, true);
        if (this.root?.parentNode) this.root.parentNode.removeChild(this.root);
        this.root = null;
        this.listEl = null;
        this.items = [];
        this.index = -1;
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this._ensureDOM();
        this._ensureCSS();
        if (this.isOpen) return;

        this.prevFocus = document.activeElement;

        // VISUALLY OPEN
        this.root.classList.add('acc-shortcuts--open');

        // Make subtree AT-visible and focusable
        this.root.removeAttribute('inert');
        this.root.setAttribute('aria-hidden', 'true');

        // Keep all items unfocused; selection is visual only.
        this.items.forEach(el => (el.tabIndex = -1));
        this.index = -1;

        // Focus dialog shell (never a list item)
        try {
            this.root.querySelector('.acc-shortcuts__dialog')?.focus();
        } catch {
        }

        const modName = this._os().isMac ? 'Option plus H' : 'Alt plus H';
        this.speech.update(
            'Shortcut help opened. Use W or S to navigate the shortcuts list. ' +
            `Press Escape or ${modName} to close.`
        );

        // Capture keystrokes while open (but allow modified combos through)
        document.addEventListener('keydown', this._onKeydownInDialog, true);
        this.isOpen = true;
    }

    close() {
        if (!this.isOpen) return;

        // VISUALLY CLOSE
        this.root.classList.remove('acc-shortcuts--open');
        document.removeEventListener('keydown', this._onKeydownInDialog, true);
        this.isOpen = false;

        // Move focus OUT before hiding from AT
        const fallback = document.querySelector('#blocklyDiv') || document.body;
        try {
            (this.prevFocus || fallback)?.focus?.();
        } catch {
        }

        // Hide from AT & make inert to future focusing
        this.root.setAttribute('aria-hidden', 'false');
        this.root.setAttribute('inert', '');

        this.speech.update('Shortcut help closed.');
    }

    // helpers
    _os() {
        const ua = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
        const isMac = /mac|iphone|ipad|ipod/.test(ua);
        const isWin = /win/.test(ua);
        return {isMac, isWin, isLinux: !isMac && !isWin};
    }

    _labelFor(key) {
        const isMac = this._os().isMac;
        const map = {
            MOD: isMac ? '⌘' : 'Ctrl',
            ALT: isMac ? '⌥' : 'Alt',
            Shift: 'Shift',
            Esc: 'Esc',
            Del: isMac ? 'Delete' : 'Del',
            '/': '/',
            'A–Z': 'A–Z'
        };
        return map[key] || key;
    }

    _speakKey(key) {
        const isMac = this._os().isMac;
        const map = {
            MOD: isMac ? 'Command' : 'Control',
            ALT: isMac ? 'Option' : 'Alt',
            Shift: 'Shift',
            Esc: 'Escape',
            Del: 'Delete',
            '/': 'Slash',
            'A–Z': 'letters A through Z'
        };
        return map[key] || key.toUpperCase?.() || String(key);
    }

    _comboHTML(parts) {
        return parts.map(k => `<kbd class="acc-shortcuts__kbd">${this._labelFor(k)}</kbd>`).join(' ');
    }

    _comboSpeech(parts) {
        return parts.map(k => this._speakKey(k)).join(' plus ');
    }

    _rowKeysToHTML(keys) {
        if (Array.isArray(keys)) return this._comboHTML(keys);
        return `<kbd class="acc-shortcuts__kbd">${this._labelFor(keys)}</kbd>`;
    }

    _rowKeysToSpeech(keys) {
        if (Array.isArray(keys)) return this._comboSpeech(keys);
        return this._speakKey(keys);
    }

    // html, css
    _ensureCSS() {
        if (document.getElementById('acc-shortcuts-style')) return;
        const css = `
/* Shortcut Assistance (auto-injected) */
.acc-shortcuts { position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  /* Tunables for spacing & alignment */
  --keysCol: clamp(180px, 32vw, 140px);
  --colGap : 2px;
}
.acc-shortcuts__backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.35);
  opacity: 0; transition: opacity .14s ease; pointer-events: none; }
.acc-shortcuts--open .acc-shortcuts__backdrop { opacity: 1; pointer-events: auto; }
.acc-shortcuts__dialog { position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(.985);
  inline-size: clamp(360px, 56vw, 860px);
  max-block-size: min(82vh, 720px);
  background: #fff; color: #111; border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0,0,0,.22);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: 0; transition: opacity .14s ease, transform .14s ease;
  pointer-events: auto; outline: none; }
.acc-shortcuts--open .acc-shortcuts__dialog { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.acc-shortcuts__header { padding: 14px 16px; border-bottom: 1px solid #eee;
  display:flex; align-items:center; justify-content:space-between; }
.acc-shortcuts__title { margin: 0; font-weight: 600; font-size: 17px; }
.acc-shortcuts__close { appearance: none; background: transparent; border: 0; font-size: 20px; cursor: pointer;
  line-height: 1; padding: 4px; border-radius: 8px; }
.acc-shortcuts__close:focus-visible { outline: 2px solid #4c8bf5; outline-offset: 2px; }
.acc-shortcuts__body { padding: 0; overflow: auto; }
.acc-shortcuts__intro { margin: 12px 16px; color: #333; font-size: 13.5px; }
.acc-shortcuts__footer { padding: 10px 14px; font-size: 12.5px; color: #444; border-top: 1px solid #eee; }
.acc-shortcuts__list { list-style: none; margin: 0; padding: 6px 0; }

/* Rows: align descriptions with a fixed keys column */
.acc-shortcuts__item {
  display: grid;
  grid-template-columns: var(--keysCol) 1fr;
  column-gap: var(--colGap);
  row-gap: 8px;
  align-items: start;
  justify-items: start;
  padding: 10px 12px;
  outline: none;
  font-size: 14px;
}
.acc-shortcuts__item + .acc-shortcuts__item { border-top: 1px solid #f0f2f6; }
.acc-shortcuts__item[tabindex="0"]:focus {
  background: #f6f7fb; box-shadow: inset 0 0 0 2px #4c8bf5;
}

/* Key chips */
.acc-shortcuts__keys {
  display: inline-flex; flex-wrap: wrap; gap: 6px;
  align-items: center; justify-self: start;
  min-block-size: 28px;
  margin-inline-end: 0;
}
.acc-shortcuts__kbd {
  display: inline-block; min-width: 22px; padding: 3px 9px; border-radius: 7px;
  background: #f8fafc; border: 1px solid #cfd7e3; color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13.5px; line-height: 20px; font-weight: 600; letter-spacing: .2px; white-space: nowrap;
}

/* Description column */
.acc-shortcuts__desc {
  line-height: 1.45;
  justify-self: start;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}
.acc-shortcuts__descTitle { font-weight: 600; margin: 0 0 2px 0; }
.acc-shortcuts__descDetail { color: #444; margin: 0; text-align: left; }

@media (max-width: 640px) {
  .acc-shortcuts__dialog { inline-size: calc(100vw - 24px); }
  .acc-shortcuts__item { grid-template-columns: 1fr; }
  .acc-shortcuts__keys { margin-bottom: 6px; }
}
@media (prefers-color-scheme: dark) {
  .acc-shortcuts__dialog { background: #1f2023; color: #f0f2f5; }
  .acc-shortcuts__item + .acc-shortcuts__item { border-color: #2b2e33; }
  .acc-shortcuts__item[tabindex="0"]:focus { background: #27292d; box-shadow: inset 0 0 0 2px #4c8bf5; }
  .acc-shortcuts__kbd { background: #2a2c31; border-color: #4a4f59; color: #f6f7fb; }
  .acc-shortcuts__header, .acc-shortcuts__footer { border-color: #2b2e33; }
  .acc-shortcuts__intro, .acc-shortcuts__descDetail { color: #cfd3da; }
}
@media (forced-colors: active) {
  .acc-shortcuts__item[tabindex="0"]:focus { outline: 2px solid Highlight; outline-offset: 0; box-shadow: none; }
  .acc-shortcuts__kbd { border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
}
@media (prefers-reduced-motion: reduce) {
  .acc-shortcuts__backdrop, .acc-shortcuts__dialog { transition: none !important; }
}

.acc-shortcuts__item--active {
  background: #f6f7fb;
  box-shadow: inset 0 0 0 2px #4c8bf5;
}

.acc-shortcuts__body { overscroll-behavior: contain; }
.acc-shortcuts__item { scroll-margin-block: 8px; }
`.trim();
        const style = document.createElement('style');
        style.id = 'acc-shortcuts-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    _ensureDOM() {
        if (this.root) return;

        const root = document.createElement('div');
        root.className = 'acc-shortcuts';
        root.innerHTML = `
      <div class="acc-shortcuts__backdrop" data-close="1"></div>
      <div class="acc-shortcuts__dialog" tabindex="-1">
        <div class="acc-shortcuts__header">
          <h2 class="acc-shortcuts__title" id="acc-shortcuts-title">Keyboard Shortcuts</h2>
          <button class="acc-shortcuts__close" type="button" aria-label="Close shortcut help" data-close="1">✕</button>
        </div>
        <div class="acc-shortcuts__body">
          <p class="acc-shortcuts__intro">
            Press W and S keys to move through shortcuts list. Press Escape (ESC) key to close the shortcut help.
          </p>
          <ul class="acc-shortcuts__list"></ul>
        </div>
        <div class="acc-shortcuts__footer">
          Tip: On macOS, “Ctrl” is shown as “⌘” (Command) and “Alt” is shown as “⌥” (Option).
        </div>
      </div>
    `;

        // Hidden by default & inert (prevents any focusing)
        root.setAttribute('aria-hidden', 'true');
        root.setAttribute('inert', '');
        document.body.appendChild(root);

        // Dialog semantics
        const dialog = root.querySelector('.acc-shortcuts__dialog');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'acc-shortcuts-title');

        const list = root.querySelector('.acc-shortcuts__list');

        // Build rows
        const rows = Constants.SHORTCUT_HELP_ROWS;
        rows.forEach((row) => {
            const li = document.createElement('li');
            li.className = 'acc-shortcuts__item';
            li.tabIndex = -1; // not focusable
            const keysHTML = this._rowKeysToHTML(row.keys);
            li.innerHTML = `
        <div class="acc-shortcuts__keys">${keysHTML}</div>
        <div class="acc-shortcuts__desc">
          <div class="acc-shortcuts__descTitle">${row.title}</div>
          ${row.detail ? `<div class="acc-shortcuts__descDetail">${row.detail}</div>` : ''}
        </div>
      `;
            list.appendChild(li);
        });

        // cache
        this.root = root;
        this.listEl = list;
        this.items = Array.from(list.querySelectorAll('.acc-shortcuts__item'));

        // click-to-close on backdrop / button
        root.addEventListener('click', this._onClickBackdrop, true);

        // Guard: if the hidden modal (aria-hidden/inert) ever receives focus, bounce it back out
        root.addEventListener('focusin', this._onFocusInGuard, true);
    }

    // Guard against focus inside hidden modal
    _onFocusInGuard(e) {
        if (!this.root) return;
        const isHidden = this.root.getAttribute('aria-hidden') === 'true';
        if (!isHidden) return;
        const fallback = document.querySelector('#blocklyDiv') || document.body;
        // Move focus away immediately to avoid "Blocked aria-hidden..." and leave AT tree consistent
        try {
            (this.prevFocus || fallback)?.focus?.();
        } catch {
        }
    }

    // speech + visual selection
    _setActive(nextIndex, speak = false) {
        nextIndex = Math.max(0, Math.min(this.items.length - 1, nextIndex));

        // clear previous visual state
        this.items.forEach(el => el.classList.remove('acc-shortcuts__item--active'));

        // set new visual state (no focus!)
        const el = this.items[nextIndex];
        el.classList.add('acc-shortcuts__item--active');
        this._scrollItemIntoView(el);

        this.index = nextIndex;

        if (speak) {
            // build a spoken label from DOM content
            const keysTxt = el.querySelector('.acc-shortcuts__keys')?.textContent?.trim() || '';
            const title = el.querySelector('.acc-shortcuts__descTitle')?.textContent?.trim() || '';
            const detail = el.querySelector('.acc-shortcuts__descDetail')?.textContent?.trim() || '';
            const label = detail ? `Shortcut ${keysTxt}. ${title}. ${detail}` : `Shortcut ${keysTxt}. ${title}`;
            const pos = `${this.index + 1} of ${this.items.length}`;
            this.speech.update(`${label}. Item ${pos}. Use W or S to move, Escape to close.`);
        }
    }

    // key events while dialog is open
    _onKeydownInDialog(e) {
        const key = e.key;
        const code = e.code;

        // Close (Esc or Alt+H)
        const altH = (key === 'h' || key === 'H') && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
        if (key === 'Escape' || altH) {
            e.preventDefault();
            e.stopPropagation();
            this.close();
            return;
        }

        // navigate using W/S (no modifiers)
        const noMods = !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
        const up = noMods && (code === 'KeyW' || key === 'w' || key === 'W');
        const down = noMods && (code === 'KeyS' || key === 's' || key === 'S');

        if (up || down) {
            e.preventDefault();
            e.stopPropagation();

            // First navigation selects initial item (none selected at open)
            if (this.index === -1) {
                this._setActive(down ? 0 : this.items.length - 1, /*speak*/ true);
                return;
            }

            this._setActive(this.index + (up ? -1 : 1), /*speak*/ true);
            return;
        }

        // page up and down
        if (key === 'PageUp') {
            e.preventDefault();
            e.stopPropagation();
            this._setActive(Math.max(0, this.index === -1 ? 0 : this.index - 5), true);
            return;
        }
        if (key === 'PageDown') {
            e.preventDefault();
            e.stopPropagation();
            this._setActive(Math.min(this.items.length - 1, this.index === -1 ? 0 : this.index + 5), true);
            return;
        }

        // Swallow only unmodified letters/digits; let modified combos (Ctrl/Meta/Alt/Shift) through to Blockly.
        const isLetterOrDigit = /^[a-z0-9]$/i.test(key);
        const hasModifier = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
        if (isLetterOrDigit && !hasModifier) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // ensure active item is visible inside the modal's scroll area
    _scrollItemIntoView(el) {
        if (!el || !this.root) return;
        const scroller = this.root.querySelector('.acc-shortcuts__body');
        if (!scroller) return;

        const pad = 8; // small cushion
        const sTop = scroller.scrollTop;
        const sRect = scroller.getBoundingClientRect();
        const r = el.getBoundingClientRect();

        if (r.top < sRect.top + pad) {
            scroller.scrollTop = sTop - (sRect.top - r.top) - pad;
            return;
        }

        if (r.bottom > sRect.bottom - pad) {
            scroller.scrollTop = sTop + (r.bottom - sRect.bottom) + pad;
        }
    }

    _onClickBackdrop(e) {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute('data-close') === '1') {
            e.preventDefault();
            this.close();
        }
    }
}
