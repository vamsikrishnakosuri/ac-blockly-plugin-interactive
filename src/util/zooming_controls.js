/**
 * Class for controlling zoom via keyboard shortcuts
 */
export class ZoomingControl {
    constructor(speech = null) {
        this.speech = speech;
    }

    /**
     * Resolve a workspace, defaulting to the main workspace.
     * @param {Blockly.WorkspaceSvg|undefined} ws
     * @returns {Blockly.WorkspaceSvg|null}
     */
    _resolveWorkspace(ws) {
        return ws || Blockly?.getMainWorkspace?.() || null;
    }

    /**
     * Whether zoom actions are currently allowed.
     * @param {Blockly.WorkspaceSvg|null} workspace
     */
    _canZoom(workspace) {
        if (!workspace || workspace.options?.readOnly) return false;
        return !Blockly?.Gesture?.inProgress?.();
    }

    /**
     * Get normalized zoom options from the workspace.
     * @param {Blockly.WorkspaceSvg} workspace
     */
    _getZoomOptions(workspace) {
        const raw = workspace?.options?.zoomOptions ?? workspace?.options?.zoom ?? {};
        return {
            startScale: typeof raw.startScale === 'number' ? raw.startScale : 1,
            scaleSpeed: typeof raw.scaleSpeed === 'number' ? raw.scaleSpeed : 1.2,
        };
    }

    /**
     * Fire Blockly's UI Click event for zoom controls (mirrors core).
     * @param {Blockly.WorkspaceSvg} workspace
     */
    _fireZoomUIEvent(workspace) {
        try {
            const evApi = Blockly?.eventUtils ?? Blockly?.Events;
            if (!evApi?.get || !evApi?.fire) return;

            const eventType = Blockly?.EventType?.CLICK;
            if (!eventType) return;

            const Click = evApi.get(eventType);
            if (Click && workspace?.id) {
                evApi.fire(new Click(null, workspace.id, 'zoom_controls'));
            }
        } catch (e) {
            // Silently ignore event firing errors - zoom functionality still works
            console.debug('Could not fire zoom UI event:', e);
        }
    }

    /**
     * Clear any touch identifiers so future drags aren’t blocked.
     */
    _clearTouchIfAny() {
        Blockly?.Touch?.clearTouchIdentifier?.();
    }

    /**
     * Dispatch a pointer/mouse event at a zoom button in the SVG.
     * @param {SVGElement|null} rootNode
     * @param {string} className
     */
    _dispatchZoomPointer(rootNode, className) {
        if (!rootNode?.querySelector) return false;
        const btn = rootNode.querySelector(`g.${className}`) || rootNode.querySelector(`.${className}`);
        if (!btn) return false;

        if (typeof window !== 'undefined' && typeof window.PointerEvent === 'function') {
            const pe = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse' });
            return btn.dispatchEvent(pe);
        }
        const me = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
        return btn.dispatchEvent(me);
    }

    /**
     * Map intent to the corresponding core button class.
     * @param {number} amount 1 => in, -1 => out, 0 => reset
     */
    _classForAmount(amount) {
        if (amount === 1) return 'blocklyZoomIn';
        if (amount === -1) return 'blocklyZoomOut';
        return 'blocklyZoomReset';
    }

    /**
     * Get the current scale from workspace (handles old/new APIs).
     * @param {Blockly.WorkspaceSvg} workspace
     */
    _getScale(workspace) {
        return workspace?.getScale?.() ?? workspace?.scale ?? 1;
    }

    // -------- core functions --------------

    /**
     * Try clicking the SVG button; fall back to imperative API.
     * @param {Blockly.WorkspaceSvg|undefined} workspace
     * @param {number} amount 1 => in, -1 => out, 0 => reset
     */
    _clickZoom(workspace, amount) {
        const ws = this._resolveWorkspace(workspace);
        if (!this._canZoom(ws)) return false;

        const svg = ws?.getParentSvg?.();
        const root = svg?.ownerSVGElement || svg || null;
        const className = this._classForAmount(amount);

        if (this._dispatchZoomPointer(root, className)) return true;
        return amount === 0 ? this._zoomResetApi(ws) : this._zoomApi(ws, amount);
    }

    /**
     * Imperative +/- zoom (compatible with multiple Blockly versions).
     * @param {Blockly.WorkspaceSvg} workspace
     * @param {number} amount
     */
    _zoomApi(workspace, amount) {
        if (!this._canZoom(workspace)) return false;

        workspace?.markFocused?.();

        if (typeof workspace.zoomCenter === 'function') {
            workspace.zoomCenter(amount);
        } else if (typeof workspace.zoom === 'function') {
            workspace.zoom(0, 0, amount);
        } else if (typeof workspace.setScale === 'function') {
            const current = this._getScale(workspace);
            workspace.setScale(amount > 0 ? current * 1.1 : current / 1.1);
        } else {
            return false;
        }

        this._fireZoomUIEvent(workspace);
        this._clearTouchIfAny();
        return true;
    }

    /**
     * Reset to startScale using the same cadence Blockly uses.
     * @param {Blockly.WorkspaceSvg} workspace
     */
    _zoomResetApi(workspace) {
        if (!this._canZoom(workspace)) return false;

        const { startScale, scaleSpeed } = this._getZoomOptions(workspace);
        const current = this._getScale(workspace);
        const amount = Math.log(startScale / current) / Math.log(scaleSpeed);

        workspace?.markFocused?.();
        workspace?.beginCanvasTransition?.();

        if (typeof workspace.zoomCenter === 'function') workspace.zoomCenter(amount);
        workspace?.scrollCenter?.();

        setTimeout(() => workspace?.endCanvasTransition?.(), 500);

        this._fireZoomUIEvent(workspace);
        this._clearTouchIfAny();
        return true;
    }

    // ------ public functions ----------

    /**
     * Zoom in (tries SVG button, falls back to API).
     * @param {Blockly.WorkspaceSvg} [workspace]
     */
    zoomIn(workspace) {
        const result = this._clickZoom(workspace, 1);
        if (result && this.speech) {
            const ws = this._resolveWorkspace(workspace);
            const scale = this._getScale(ws);
            const percentage = Math.round(scale * 100);
            console.log("ZOOM in")
            this.speech.update(`Zoomed in to ${percentage}%`);
        }
        return result;
    }

    /**
     * Zoom out (tries SVG button, falls back to API).
     * @param {Blockly.WorkspaceSvg} [workspace]
     */
    zoomOut(workspace) {
        const result = this._clickZoom(workspace, -1);
        if (result && this.speech) {
            const ws = this._resolveWorkspace(workspace);
            const scale = this._getScale(ws);
            const percentage = Math.round(scale * 100);
            this.speech.update(`Zoomed out to ${percentage}%`);
        }
        return result;
    }

    /**
     * Reset zoom to startScale (tries SVG button, falls back to API).
     * @param {Blockly.WorkspaceSvg} [workspace]
     */
    zoomReset(workspace) {
        const result = this._clickZoom(workspace, 0);
        if (result && this.speech) {
            const ws = this._resolveWorkspace(workspace);
            const { startScale } = this._getZoomOptions(ws);
            const percentage = Math.round(startScale * 100);
            this.speech.update(`Zoom reset to ${percentage}%`);
        }
        return result;
    }
}
