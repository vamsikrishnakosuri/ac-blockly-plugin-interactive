(function () {
    class KeyOverlay {
        constructor(opts = {}) {
            this.hideDelayMs = opts.hideDelayMs ?? 5000; // default: 5s
            this.root = null;
            this.list = null;
            this.timer = null;

            // Track currently held keys and last combo
            this.held = new Set();
            this.lastCombo = [];

            this.isMac = this._detectMac();

            // key events binding
            this._onKeyDown = this._onKeyDown.bind(this);
            this._onKeyUp = this._onKeyUp.bind(this);
            this._onBlur = this._onBlur.bind(this);
            this._render = this._render.bind(this);
            this._scheduleHide = this._scheduleHide.bind(this);
            this._clearHide = this._clearHide.bind(this);
        }

        attach() {
            this._ensureDom();
            window.addEventListener('keydown', this._onKeyDown, true);
            window.addEventListener('keyup', this._onKeyUp, true);
            window.addEventListener('blur', this._onBlur, true);
        }

        detach() {
            window.removeEventListener('keydown', this._onKeyDown, true);
            window.removeEventListener('keyup', this._onKeyUp, true);
            window.removeEventListener('blur', this._onBlur, true);
            this._destroyDom();
        }

        // key events
        _onKeyDown(e) {
            if (e.isComposing) return;

            // Always rebuild modifiers from event flags first
            this._syncModifiersFromEvent(e);

            // Compute display key from physical code when needed
            const norm = this.normalizeKey(e.key, e.code, e);
            if (norm && !this._isModifier(norm)) {
                this.held.add(norm); // only non-modifiers live in held via name
            }

            const combo = this._orderedCombo(Array.from(this.held));
            this.lastCombo = combo.length ? combo : this.lastCombo;

            this._render(combo.length ? combo : this.lastCombo);
            this._clearHide();
            this._scheduleHide();
        }


        _onKeyUp(e) {
            if (e.isComposing) return;

            // Re-sync modifiers from current flags
            this._syncModifiersFromEvent(e);

            // Remove only non-modifier keys by their label
            const norm = this.normalizeKey(e.key, e.code, e);
            if (norm && !this._isModifier(norm)) {
                this.held.delete(norm);
            }

            const combo = this._orderedCombo(Array.from(this.held));
            this._render(combo.length ? combo : this.lastCombo);
            this._clearHide();
            this._scheduleHide();
        }


        _onBlur() {
            this.held.clear();
            this._clearHide();
            this._scheduleHide();
        }

        // html dom rendering
        _ensureDom() {
            if (this.root) return;
            const root = document.createElement('div');
            root.className = 'key-overlay';
            root.setAttribute('aria-hidden', 'true');
            root.innerHTML = `
        <div class="key-overlay__bubble">
          <div class="key-overlay__list"></div>
        </div>`;
            document.body.appendChild(root);
            this.root = root;
            this.list = root.querySelector('.key-overlay__list');
        }

        _destroyDom() {
            if (this.root?.parentNode) this.root.parentNode.removeChild(this.root);
            this.root = null;
            this.list = null;
        }

        _render(combo) {
            if (!this.root || !this.list) return;

            if (!combo || combo.length === 0) {
                this._hide();
                return;
            }

            this.list.textContent = '';
            combo.forEach((token, i) => {
                const k = document.createElement('span');
                k.className = 'key-overlay__kbd';
                k.textContent = token;
                this.list.appendChild(k);
                if (i < combo.length - 1) {
                    const plus = document.createElement('span');
                    plus.className = 'key-overlay__plus';
                    plus.textContent = '+';
                    this.list.appendChild(plus);
                }
            });

            this.root.classList.add('is-visible');
        }

        _hide() {
            if (!this.root) return;
            this.root.classList.remove('is-visible');
        }

        _scheduleHide() {
            this._clearHide();
            this.timer = setTimeout(() => {
                this.lastCombo = [];
                this._hide();
            }, this.hideDelayMs);
        }

        _clearHide() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }

        // system wise key normalization
        _detectMac() {
            const ua = navigator.userAgent || '';
            return /\bMacintosh\b|\bMac OS X\b/.test(ua);
        }

        _labelFromCode(code) {
            if (!code) return '';
            if (/^Key[A-Z]$/i.test(code))   return code.slice(3).toUpperCase(); // KeyA -> A
            if (/^Digit[0-9]$/.test(code))  return code.slice(5);               // Digit1 -> 1

            // Common US-ANSI punctuation keys (stable across Option layers)
            const map = {
                'Minus': '-', 'Equal': '=',
                'BracketLeft': '[', 'BracketRight': ']',
                'Backslash': '\\',
                'Semicolon': ';', 'Quote': "'",
                'Comma': ',', 'Period': '.', 'Slash': '/',
                'Backquote': '`',
            };
            return map[code] || '';
        }


        normalizeKey(rawKey, code, ev) {
            const mac = this.isMac;
            const altLike = !!(ev?.altKey || ev?.getModifierState?.('AltGraph'));

            // ALWAYS use the physical key label
            if (mac && altLike) {
                const fromCode = this._labelFromCode(code);
                if (fromCode) return fromCode;        // example: Option+KeyA -> "A" (not å)
                if (rawKey === 'Dead') {
                    // Some layouts report 'Dead' with no useful code label
                    return this._labelFromCode(code) || 'Dead';
                }
            }

            if (rawKey && rawKey.length === 1 && /[^\x00-\x7F]/.test(rawKey)) {
                const fromCode = this._labelFromCode(code);
                if (fromCode) return fromCode;
            }

            let k = String(rawKey || '');

            switch (k) {
                case ' ':
                case 'Spacebar':
                case 'Space': return 'Space';
                case 'ArrowUp': return '↑';
                case 'ArrowDown': return '↓';
                case 'ArrowLeft': return '←';
                case 'ArrowRight': return '→';
                case 'Escape':
                case 'Esc': return 'Esc';
                case 'Enter': return 'Enter';
                case 'Tab': return 'Tab';
                case 'Backspace': return 'Backspace';
                case 'Delete': return 'Delete';
                case 'PageUp': return 'PgUp';
                case 'PageDown': return 'PgDn';
                case 'Home': return 'Home';
                case 'End': return 'End';
                case 'Meta':
                case 'OS':
                case 'Super': return this.isMac ? '⌘' : 'Win';
                case 'Control': return this.isMac ? '⌃' : 'Ctrl';
                case 'AltGraph': return this.isMac ? '⌥' : 'AltGr';
                case 'Alt': return this.isMac ? '⌥' : 'Alt';
                case 'Shift': return this.isMac ? '⇧' : 'Shift';
            }

            if (k.length === 1) {
                if (/[a-z]/.test(k)) return k.toUpperCase();
                return k;
            }

            if (/^F\d{1,2}$/.test(k)) return k;

            return k;
        }

        _isModifier(token) {
            return (
                token === 'Ctrl' || token === '⌘' || token === 'Win' || token === '⌃' ||
                token === 'Alt' || token === '⌥' || token === 'AltGr' ||
                token === 'Shift' || token === '⇧'
            );
        }

        _orderedCombo(tokens) {
            if (!tokens || tokens.length === 0) return [];

            const uniq = Array.from(new Set(tokens));
            const weight = (t) => {
                if (t === '⌘' || t === 'Win' || t === 'Ctrl' || t === '⌃') return 1;
                if (t === 'Shift' || t === '⇧') return 2;
                if (t === 'Alt' || t === '⌥' || t === 'AltGr') return 3;
                return 10;
            };

            return uniq.sort((a, b) => {
                const da = weight(a);
                const db = weight(b);
                if (da !== db) return da - db;
                return String(a).localeCompare(String(b));
            });
        }

        _syncModifiersFromEvent(e) {
            const want = new Set();
            if (e.metaKey) want.add(this.isMac ? '⌘' : 'Win');
            if (e.ctrlKey) want.add(this.isMac ? '⌃' : 'Ctrl');
            if (e.shiftKey) want.add(this.isMac ? '⇧' : 'Shift');
            if (e.altKey) want.add(this.isMac ? '⌥' : 'Alt');

            if (e.getModifierState && e.getModifierState('AltGraph')) {
                want.add(this.isMac ? '⌥' : 'AltGr');
            }

            for (const t of Array.from(this.held)) {
                if (this._isModifier(t) && !want.has(t)) this.held.delete(t);
            }
            for (const t of want) this.held.add(t);
        }
    }

    // expose globally
    window.KeyOverlay = KeyOverlay;
})();
