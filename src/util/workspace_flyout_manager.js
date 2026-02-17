/**
 * Manages workspace block filtering when marker is on workspace.
 * Only enables container blocks (in the FLYOUT) that can hold other blocks.
 * Disables non-container blocks in the flyout when the marker is on WORKSPACE.
 */
export class WorkspaceContainerFilter {
    static DISABLED_REASON = 'acc_workspace_marker_filter';

    /**
     * Container block types that can accept child blocks.
     * Expand this list based on your block library.
     */
    static CONTAINER_BLOCK_TYPES = new Set([
        // Control flow
        'controls_if',
        'controls_ifelse',
        'controls_repeat_ext',
        'controls_repeat',
        'controls_whileUntil',
        'controls_for',
        'controls_forEach',

        // Procedures
        'procedures_defnoreturn',
        'procedures_defreturn',

        // Loops & iteration
        'controls_do_while',

        // Variables
        'variables_set',
        'math_change',

        // other independent blocks
        'text_print'
    ]);

    /**
     * Checks if a block is a container block that can hold children.
     * @param {!Blockly.BlockSvg} block The block to check.
     * @returns {boolean} True if the block is a container.
     */
    isContainerBlock(block) {
        if (!block) return false;

        // 1) explicit allow-list
        if (WorkspaceContainerFilter.CONTAINER_BLOCK_TYPES.has(block.type)) {
            return true;
        }

        // 2) heuristic: has at least one statement input (nesting slot)
        if (Array.isArray(block.inputList)) {
            return block.inputList.some(
                (input) => input?.connection?.type === Blockly.NEXT_STATEMENT
            );
        }

        return false;
    }

    /**
     * Returns the flyout's internal workspace (template blocks live here).
     * @param {!Blockly.WorkspaceSvg} workspace
     * @returns {?Blockly.WorkspaceSvg}
     */
    _getFlyoutWorkspace(workspace) {
        return workspace?.getFlyout?.()?.getWorkspace?.() || null;
    }

    /**
     * Returns all top blocks in the flyout.
     * @param {object} workspace
     * @returns {!Array<!Blockly.BlockSvg>}
     */
    _getFlyoutBlocks(workspace) {
        const flyoutWS = this._getFlyoutWorkspace(workspace);
        return flyoutWS?.getTopBlocks?.(false) || [];
    }

    /**
     * Clears all workspace container filter disabled reasons from FLYOUT blocks.
     */
    clearWorkspaceFilters(workspace) {
        const reason = WorkspaceContainerFilter.DISABLED_REASON;
        const blocks = this._getFlyoutBlocks(workspace);
        for (const block of blocks) {
            try {
                if (typeof block.setDisabledReason === 'function') {
                    block.setDisabledReason(false, reason);
                } else if (typeof block.setEnabled === 'function') {
                    block.setEnabled(true);
                }
            } catch (e) {
                console.warn('Failed to clear disabled reason on flyout block:', e);
            }
        }
    }

    /**
     * Updates disabled state of FLYOUT blocks based on marker position.
     * When filtering, disable ALL non-container blocks in the flyout.
     * @param {object} workspace The main workspace.
     */
    updateWorkspaceBlockStates(workspace) {
        const reason = WorkspaceContainerFilter.DISABLED_REASON;
        const blocks = this._getFlyoutBlocks(workspace);

        for (const block of blocks) {
            try {
                const isContainer = this.isContainerBlock(block);
                const shouldDisable = !isContainer;

                if (typeof block.setDisabledReason === 'function') {
                    block.setDisabledReason(shouldDisable, reason);
                } else if (typeof block.setEnabled === 'function') {
                    block.setEnabled(!shouldDisable);
                }
            } catch (e) {
                console.error('Error updating flyout block state:', e);
            }
        }
    }

    /**
     * Determines if filtering should be active:
     * - Marker is on WORKSPACE, and
     * - Flyout is visible/open.
     * @param {!Blockly.WorkspaceSvg} workspace The main workspace.
     * @returns {boolean} True if filtering should be applied.
     */
    shouldApplyFilter(workspace) {
        const marker = workspace?.getMarker?.('local_marker_1');
        const markerNode = marker?.getCurNode?.();
        if (!markerNode) return false;

        const isOnWorkspace =
            markerNode.getType?.() === Blockly.ASTNode.types.WORKSPACE;

        const flyout = workspace.getFlyout?.();
        const flyoutVisible = !!flyout && (flyout.isVisible?.() ?? !flyout.autoClose);

        return isOnWorkspace && flyoutVisible;
    }

    /**
     * Applies container block filtering to the FLYOUT when marker is on workspace.
     *
     * @param {object} workspace The main workspace.
     * @param {boolean} shouldFilter Whether to apply filtering.
     */
    applyFilter(workspace, shouldFilter) {
        // Always clear old filter state first.
        this.clearWorkspaceFilters(workspace);

        if (shouldFilter) {
            this.updateWorkspaceBlockStates(workspace);
        }
    }

    /**
     * Smart filter: applies or clears based on current marker position.
     * Call this whenever marker state, toolbox category, or flyout visibility changes.
     */
    updateFilter(workspace) {
        this.applyFilter(workspace, this.shouldApplyFilter(workspace));
    }
}
