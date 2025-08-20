/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Implements stack search functionality in Blockly.
 * Allows users to quickly navigate to stacks by their alphabetical labels.
 * Activated with Alt+Shift+G (safe for screen readers).
 */

import * as Blockly from 'blockly/core';
import { getStackLabelManager } from './stack_labels.js';

// Global registry to track all StackSearchManager instances by workspace ID
const stackSearchManagerRegistry = new Map();

/**
 * Get a StackSearchManager instance for a specific workspace.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to get the manager for.
 * @return {StackSearchManager|null} The manager for the workspace, or null if none exists.
 */
export function getStackSearchManager(workspace) {
  if (!workspace || !workspace.id) return null;
  return stackSearchManagerRegistry.get(workspace.id) || null;
}

/**
 * Class for managing stack search functionality.
 * Allows quick navigation to stacks by their alphabetical labels.
 */
export class StackSearchManager {
  /**
   * Constructor for the StackSearchManager.
   * @param {!Blockly.WorkspaceSvg} workspace The workspace to manage stack search for.
   */
  constructor(workspace) {
    /**
     * The workspace this manager is associated with.
     * @type {!Blockly.WorkspaceSvg}
     * @private
     */
    this.workspace_ = workspace;
    
    // Register this instance in the global registry
    if (workspace && workspace.id) {
      stackSearchManagerRegistry.set(workspace.id, this);
    }
    
    /**
     * Whether the manager is currently enabled.
     * @type {boolean}
     * @private
     */
    this.enabled_ = false;
    
    /**
     * The currently active search overlay, if any.
     * @type {HTMLElement|null}
     * @private
     */
    this.activeOverlay_ = null;
    
    /**
     * Whether search mode is currently active.
     * @type {boolean}
     * @private
     */
    this.searchActive_ = false;
    
    /**
     * Bound event handlers for cleanup.
     * @type {!Array<function()>}
     * @private
     */
    this.boundEventHandlers_ = [];
  }
  
  /**
   * Initialize the stack search manager.
   */
  init() {
    if (this.enabled_) return;
    
    this.enabled_ = true;
    console.log('Stack search: Initialized for workspace', this.workspace_.id);
  }
  
  /**
   * Handle the stack search shortcut activation.
   * @param {!Blockly.WorkspaceSvg} workspace The workspace to search in.
   * @return {boolean} True if the shortcut was handled.
   */
  handleStackSearchShortcut_(workspace) {
    console.log('Stack search: Shortcut activated');
    
    if (!workspace) return false;
    
    // Check if we're in keyboard accessibility mode
    if (!workspace.keyboardAccessibilityMode) {
      console.log('Stack search: Keyboard accessibility mode not enabled');
      return false;
    }
    
    // If search is already active, cancel it
    if (this.searchActive_) {
      this.cancelSearch_();
      return true;
    }
    
    // Get available stacks from stack label manager
    const stackLabelManager = getStackLabelManager(workspace);
    if (!stackLabelManager) {
      console.log('Stack search: No stack label manager found');
      return false;
    }
    
    // Get all available stack letters
    const availableStacks = this.getAvailableStacks_(stackLabelManager);
    
    if (availableStacks.length === 0) {
      console.log('Stack search: No labeled stacks found');
      this.announceMessage_('No labeled stacks available to search');
      return false;
    }
    
    // Start search mode
    this.startSearchMode_(availableStacks);
    return true;
  }
  
  /**
   * Get all available stack letters from the stack label manager.
   * @param {!StackLabelManager} stackLabelManager The stack label manager.
   * @return {!Array<{letter: string, blockId: string, label: string}>} Available stacks.
   * @private
   */
  getAvailableStacks_(stackLabelManager) {
    const stacks = [];
    
    try {
      // Access the internal stackLetters_ map to get all labeled stacks
      if (stackLabelManager.stackLetters_) {
        for (const [blockId, letter] of stackLabelManager.stackLetters_.entries()) {
          // Get the block to ensure it still exists
          const block = this.workspace_.getBlockById(blockId);
          if (block) {
            // Get custom label if available
            const customText = stackLabelManager.customLabels_?.get(blockId) || '';
            const fullLabel = customText ? `${letter} ${customText}` : letter;
            
            stacks.push({
              letter: letter,
              blockId: blockId,
              label: fullLabel
            });
          }
        }
      }
    } catch (e) {
      console.warn('Stack search: Error getting available stacks', e);
    }
    
    // Sort by letter for consistent ordering
    stacks.sort((a, b) => a.letter.localeCompare(b.letter));
    
    return stacks;
  }
  
  /**
   * Start search mode and show available stacks.
   * @param {!Array<{letter: string, blockId: string, label: string}>} availableStacks Available stacks.
   * @private
   */
  startSearchMode_(availableStacks) {
    this.searchActive_ = true;
    
    // Create search overlay
    this.createSearchOverlay_(availableStacks);
    
    // Bind keyboard handlers for search
    this.bindSearchKeyHandlers_();
    
    // Announce to screen readers
    const stackList = availableStacks.map(s => s.label).join(', ');
    this.announceMessage_(`Stack search active. Available stacks: ${stackList}. Press a letter to navigate, or Escape to cancel.`);
  }
  
  /**
   * Create and show the search overlay.
   * @param {!Array<{letter: string, blockId: string, label: string}>} availableStacks Available stacks.
   * @private
   */
  createSearchOverlay_(availableStacks) {
    // Remove any existing overlay
    this.removeSearchOverlay_();
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'blockly-stack-search-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Stack Search');
    overlay.setAttribute('aria-live', 'polite');
    
    // Create content
    const content = document.createElement('div');
    content.className = 'blockly-stack-search-content';
    
    const title = document.createElement('div');
    title.className = 'blockly-stack-search-title';
    title.textContent = 'Navigate to Stack';
    
    const instructions = document.createElement('div');
    instructions.className = 'blockly-stack-search-instructions';
    instructions.textContent = 'Press a letter key to jump to that stack:';
    
    const stackList = document.createElement('div');
    stackList.className = 'blockly-stack-search-list';
    
    // Add available stacks
    availableStacks.forEach(stack => {
      const stackItem = document.createElement('div');
      stackItem.className = 'blockly-stack-search-item';
      stackItem.textContent = `${stack.letter} - ${stack.label}`;
      stackList.appendChild(stackItem);
    });
    
    const cancelInstructions = document.createElement('div');
    cancelInstructions.className = 'blockly-stack-search-cancel';
    cancelInstructions.textContent = 'Press Escape to cancel';
    
    content.appendChild(title);
    content.appendChild(instructions);
    content.appendChild(stackList);
    content.appendChild(cancelInstructions);
    overlay.appendChild(content);
    
    // Add to document
    document.body.appendChild(overlay);
    this.activeOverlay_ = overlay;
    
    // Focus the overlay for accessibility
    overlay.focus();
  }
  
  /**
   * Bind keyboard event handlers for search mode.
   * @private
   */
  bindSearchKeyHandlers_() {
    const keyHandler = (event) => {
      if (!this.searchActive_) return;
      
      const key = event.key.toUpperCase();
      
      // Handle Escape key to cancel
      if (event.key === 'Escape') {
        this.cancelSearch_();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      // Handle letter keys for navigation
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        if (this.navigateToStack_(key)) {
          this.cancelSearch_();
        }
        event.preventDefault();
        event.stopPropagation();
      }
    };
    
    // Bind to document to catch all key events
    document.addEventListener('keydown', keyHandler, true);
    this.boundEventHandlers_.push(() => {
      document.removeEventListener('keydown', keyHandler, true);
    });
  }
  
  /**
   * Navigate to a specific stack by its letter.
   * @param {string} letter The stack letter to navigate to.
   * @return {boolean} True if navigation was successful.
   * @private
   */
  navigateToStack_(letter) {
    const stackLabelManager = getStackLabelManager(this.workspace_);
    if (!stackLabelManager) {
      this.announceMessage_('Stack label manager not available');
      return false;
    }
    
    // Find the block with this letter
    let targetBlockId = null;
    if (stackLabelManager.stackLetters_) {
      for (const [blockId, stackLetter] of stackLabelManager.stackLetters_.entries()) {
        if (stackLetter === letter) {
          targetBlockId = blockId;
          break;
        }
      }
    }
    
    if (!targetBlockId) {
      this.announceMessage_(`No stack found with letter ${letter}`);
      return false;
    }
    
    // Get the target block
    const targetBlock = this.workspace_.getBlockById(targetBlockId);
    if (!targetBlock) {
      this.announceMessage_(`Stack ${letter} block not found`);
      return false;
    }
    
    // Move cursor to the target block
    const cursor = this.workspace_.getCursor();
    if (!cursor) {
      this.announceMessage_('Workspace cursor not available');
      return false;
    }
    
    try {
      // Create an AST node for the block and move cursor to it
      const astNode = Blockly.ASTNode.createBlockNode(targetBlock);
      cursor.setCurNode(astNode);
      
      // Get label for announcement
      const customText = stackLabelManager.customLabels_?.get(targetBlockId) || '';
      const fullLabel = customText ? `${letter} ${customText}` : letter;
      
      // Announce successful navigation
      this.announceMessage_(`Navigated to stack ${fullLabel}`);
      
      console.log('Stack search: Successfully navigated to stack', letter, targetBlockId);
      return true;
    } catch (e) {
      console.warn('Stack search: Error navigating to block', e);
      this.announceMessage_(`Error navigating to stack ${letter}`);
      return false;
    }
  }
  
  /**
   * Cancel the current search and cleanup.
   * @private
   */
  cancelSearch_() {
    console.log('Stack search: Canceling search');
    
    this.searchActive_ = false;
    this.removeSearchOverlay_();
    this.unbindSearchKeyHandlers_();
    
    // Restore focus to workspace
    this.restoreWorkspaceFocus_();
    
    this.announceMessage_('Stack search canceled');
  }
  
  /**
   * Remove the search overlay from the DOM.
   * @private
   */
  removeSearchOverlay_() {
    if (this.activeOverlay_) {
      if (this.activeOverlay_.parentNode) {
        this.activeOverlay_.parentNode.removeChild(this.activeOverlay_);
      }
      this.activeOverlay_ = null;
    }
  }
  
  /**
   * Unbind all search-related keyboard event handlers.
   * @private
   */
  unbindSearchKeyHandlers_() {
    this.boundEventHandlers_.forEach(unbinder => unbinder());
    this.boundEventHandlers_.length = 0;
  }
  
  /**
   * Restore focus to the workspace after search.
   * @private
   */
  restoreWorkspaceFocus_() {
    try {
      const workspaceDiv = this.workspace_.getParentSvg();
      if (workspaceDiv && workspaceDiv.parentNode) {
        const blocklyDiv = workspaceDiv.closest('.blocklyDiv') || workspaceDiv.parentNode;
        if (blocklyDiv && blocklyDiv.focus) {
          blocklyDiv.focus();
        }
      }
    } catch (e) {
      console.warn('Stack search: Could not restore workspace focus', e);
    }
  }
  
  /**
   * Announce a message to screen readers.
   * @param {string} message The message to announce.
   * @private
   */
  announceMessage_(message) {
    try {
      // Create temporary announcement element for screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = message;
      
      document.body.appendChild(announcement);
      
      // Remove after announcement
      setTimeout(() => {
        if (announcement.parentNode) {
          announcement.parentNode.removeChild(announcement);
        }
      }, 1000);
      
      console.log('Stack search:', message);
    } catch (e) {
      console.warn('Stack search: Could not announce message', e);
    }
  }
  
  /**
   * Disable the stack search manager and clean up.
   */
  disable() {
    this.enabled_ = false;
    
    // Cancel any active search
    if (this.searchActive_) {
      this.cancelSearch_();
    }
    
    // Remove from registry
    if (this.workspace_ && this.workspace_.id) {
      stackSearchManagerRegistry.delete(this.workspace_.id);
    }
    
    console.log('Stack search: Disabled for workspace', this.workspace_.id);
  }
}

/**
 * Initialize stack search for a workspace.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to initialize search on.
 * @return {!StackSearchManager} The stack search manager instance.
 */
export function initStackSearch(workspace) {
  // Validate workspace
  if (!workspace || !workspace.id) {
    console.error('Cannot initialize stack search: invalid workspace');
    return null;
  }
  
  // Check if an instance already exists for this workspace
  let manager = stackSearchManagerRegistry.get(workspace.id);
  
  // If no instance exists, create one
  if (!manager) {
    manager = new StackSearchManager(workspace);
    manager.init();
  } else {
    // If a manager already exists, just ensure it's initialized
    if (!manager.enabled_) {
      manager.init();
    }
  }
  
  return manager;
}

/**
 * Dispose stack search for a workspace.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to dispose search for.
 */
export function disposeStackSearch(workspace) {
  if (!workspace || !workspace.id) return;
  
  const manager = stackSearchManagerRegistry.get(workspace.id);
  if (manager) {
    manager.disable();
  }
}

// Add styles for the search overlay
document.head.insertAdjacentHTML('beforeend', `
<style>
  .blockly-stack-search-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #1976d2;
    border-radius: 8px;
    padding: 20px;
    min-width: 300px;
    max-width: 500px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    outline: none;
  }
  
  .blockly-stack-search-title {
    font-size: 18px;
    font-weight: bold;
    color: #1976d2;
    margin-bottom: 12px;
    text-align: center;
  }
  
  .blockly-stack-search-instructions {
    font-size: 14px;
    color: #333;
    margin-bottom: 16px;
    text-align: center;
  }
  
  .blockly-stack-search-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f9f9f9;
  }
  
  .blockly-stack-search-item {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    font-family: monospace;
    font-size: 14px;
    color: #333;
  }
  
  .blockly-stack-search-item:last-child {
    border-bottom: none;
  }
  
  .blockly-stack-search-item:hover {
    background: #e3f2fd;
  }
  
  .blockly-stack-search-cancel {
    font-size: 12px;
    color: #666;
    text-align: center;
    font-style: italic;
  }
</style>
`);
