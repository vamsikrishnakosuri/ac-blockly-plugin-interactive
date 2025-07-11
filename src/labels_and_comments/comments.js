/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Implements hover-style comments in Blockly.
 * Comments appear as tooltips when blocks are focused.
 */

import * as Blockly from 'blockly/core';

/**
 * Class for managing hover-style comments on blocks.
 */
export class CommentsManager {
  /**
   * Constructor for the CommentsManager.
   * @param {!Blockly.WorkspaceSvg} workspace The workspace to add comments to.
   */
  constructor(workspace) {
    /** @private {!Blockly.WorkspaceSvg} The workspace to add comments to. */
    this.workspace_ = workspace;
    
    /** @private {!Map<string, string>} Map of block IDs to comment text. */
    this.blockComments_ = new Map();
    
    /** @private {SVGGElement} SVG group for all comments. */
    this.commentGroup_ = null;
    
    /** @private {SVGGElement|null} Currently visible comment. */
    this.visibleComment_ = null;
    
    /** @private {Element|null} The ARIA live region for announcing comments. */
    this.ariaLiveRegion_ = null;
    
    /** @private {boolean} Whether the manager is initialized. */
    this.initialized_ = false;
  }
  
  /**
   * Initialize the comments manager.
   */
  init() {
    if (this.initialized_) {
      return;
    }
    
    this.initialized_ = true;
    
    // Create SVG group for comments
    this.createCommentGroup_();
    
    // Create ARIA live region for accessibility
    this.createAriaLiveRegion_();
    
    // Register keyboard shortcut
    this.registerCommentShortcut_();
    
    // Add event listeners
    this.bindEvents_();
  }
  
  /**
   * Creates the SVG group where all comments will be rendered.
   * @private
   */
  createCommentGroup_() {
    // Get the main SVG from workspace
    const svg = this.workspace_.getParentSvg();
    if (!svg) return;
    
    // Create a group for comments
    const group = Blockly.utils.dom.createSvgElement(
        'g',
        {'class': 'blocklyComments'},
        svg);
    
    this.commentGroup_ = group;
  }
  
  /**
   * Creates an ARIA live region for accessibility.
   * @private
   */
  createAriaLiveRegion_() {
    if (this.ariaLiveRegion_) return;
    
    this.ariaLiveRegion_ = document.createElement('div');
    this.ariaLiveRegion_.setAttribute('aria-live', 'polite');
    this.ariaLiveRegion_.setAttribute('role', 'status');
    this.ariaLiveRegion_.classList.add('blockly-screen-reader-only');
    this.ariaLiveRegion_.style.position = 'absolute';
    this.ariaLiveRegion_.style.left = '-9999px';
    this.ariaLiveRegion_.style.height = '1px';
    this.ariaLiveRegion_.style.width = '1px';
    this.ariaLiveRegion_.style.overflow = 'hidden';
    document.body.appendChild(this.ariaLiveRegion_);
  }
  
  /**
   * Register keyboard shortcut for adding comments.
   * @private
   */
  registerCommentShortcut_() {
    const commentShortcut = {
      name: 'addBlockComment',
      preconditionFn: (workspace) => {
        return workspace.keyboardAccessibilityMode;
      },
      callback: (workspace) => {
        this.handleCommentShortcut_(workspace);
        return true;
      }
    };
    
    // Register the shortcut
    Blockly.ShortcutRegistry.registry.register(commentShortcut);
    
    // Map Alt+M to the comment shortcut
    const altM = Blockly.ShortcutRegistry.registry.createSerializedKey(
        Blockly.utils.KeyCodes.M,
        [Blockly.utils.KeyCodes.ALT]
    );
    
    Blockly.ShortcutRegistry.registry.addKeyMapping(
        altM,
        commentShortcut.name
    );
  }
  
  /**
   * Unregister comment shortcut.
   * @private
   */
  unregisterCommentShortcut_() {
    try {
      Blockly.ShortcutRegistry.registry.unregister('addBlockComment');
    } catch (e) {
      console.warn('Error unregistering comment shortcut:', e);
    }
  }
  
  /**
   * Handle keyboard shortcut to add a comment.
   * @param {!Blockly.WorkspaceSvg} workspace The workspace.
   * @private
   */
  handleCommentShortcut_(workspace) {
    const cursor = workspace.getCursor();
    if (!cursor || !cursor.getCurNode()) {
      return;
    }
    
    const curNode = cursor.getCurNode();
    const block = curNode.getSourceBlock();
    
    if (!block) {
      return;
    }
    
    // Add or edit comment for the block with keyboard focus
    this.promptForComment_(block);
  }
  
  /**
   * Bind workspace events.
   * @private
   */
  bindEvents_() {
    // Handle marker move events to show/hide comments
    this.workspace_.addChangeListener((event) => {
      if (event.type === Blockly.Events.MARKER_MOVE) {
        this.handleMarkerMove_(event);
      } else if (event.type === Blockly.Events.BLOCK_DELETE) {
        // Remove comment when block is deleted
        this.blockComments_.delete(event.blockId);
      }
    });
  }
  
  /**
   * Handle marker move events to show/hide comments based on block focus.
   * @param {!Blockly.Events.MarkerMove} event The marker move event.
   * @private
   */
  handleMarkerMove_(event) {
    const curNode = this.workspace_.getCursor().getCurNode();
    
    // Hide previously shown comment
    this.hideComment_();
    
    if (!curNode) return;
    
    const block = curNode.getSourceBlock();
    if (!block) return;
    
    const commentText = this.blockComments_.get(block.id);
    if (commentText) {
      this.showComment_(block, commentText);
    }
  }
  
  /**
   * Prompt for a comment on a block.
   * @param {!Blockly.Block} block The block to comment on.
   * @private
   */
  promptForComment_(block) {
    const existingText = this.blockComments_.get(block.id) || '';
    const commentText = prompt('Enter a comment for this block:', existingText);
    
    if (commentText === null) {
      // User cancelled
      return;
    }
    
    if (commentText.trim() === '') {
      // Empty comment, remove if exists
      if (this.blockComments_.has(block.id)) {
        this.blockComments_.delete(block.id);
        this.announceComment_(`Comment removed from block ${block.type}`);
      }
    } else {
      // Add or update comment
      this.blockComments_.set(block.id, commentText);
      
      // Show the comment if the block is currently focused
      const curNode = this.workspace_.getCursor().getCurNode();
      if (curNode && curNode.getSourceBlock() === block) {
        this.hideComment_();
        this.showComment_(block, commentText);
      }
      
      this.announceComment_(`Comment ${existingText ? 'updated' : 'added'} to block ${block.type}`);
    }
  }
  
  /**
   * Show a comment for a block.
   * @param {!Blockly.Block} block The block to show comment for.
   * @param {string} text The comment text to show.
   * @private
   */
  showComment_(block, text) {
    if (!this.commentGroup_ || !text) return;
    
    // Hide any existing comment
    this.hideComment_();
    
    // Get block position
    const blockPos = this.getBlockPosition_(block);
    if (!blockPos) return;
    
    // Create comment element
    const commentGroup = Blockly.utils.dom.createSvgElement(
        'g',
        {'class': 'blocklyComment'},
        this.commentGroup_);
    
    // Calculate dimensions based on text content
    const lines = text.split('\n');
    const lineCount = lines.length;
    
    // Find the longest line to determine width
    let maxLineLength = 0;
    for (let i = 0; i < lines.length; i++) {
      maxLineLength = Math.max(maxLineLength, lines[i].length);
    }
    
    // Base dimensions
    const charWidth = 6.5; // Approximate width per character in pixels
    const lineHeight = 16; // Height per line in pixels
    const padding = 8;  // Padding around text
    
    // Calculate dimensions (with min/max constraints)
    const width = Math.min(Math.max(maxLineLength * charWidth + padding * 2, 100), 250); 
    const height = Math.min(Math.max(lineCount * lineHeight + padding * 2, 30), 150);
    
    // Position comment above the block
    const x = blockPos.x + (block.width / 2) - (width / 2);
    const y = blockPos.y - height - 5;
    
    // Create comment background
    Blockly.utils.dom.createSvgElement(
        'rect',
        {
          'x': x,
          'y': y,
          'width': width,
          'height': height,
          'rx': 3,
          'ry': 3,
          'fill': '#FFFFA5', // Light yellow
          'stroke': '#F0D900',
          'stroke-width': 1
        },
        commentGroup);
    
    // Create text element
    const textElement = Blockly.utils.dom.createSvgElement(
        'text',
        {
          'x': x + padding,
          'y': y + padding + lineHeight - 2,
          'font-size': '12px',
          'font-family': 'Arial',
          'fill': '#000'
        },
        commentGroup);
    
    // Add text with wrapping
    for (let i = 0; i < lines.length; i++) {
      const tspan = Blockly.utils.dom.createSvgElement(
          'tspan',
          {
            'x': x + padding,
            'dy': i === 0 ? 0 : lineHeight
          },
          textElement);
      tspan.textContent = lines[i];
    }
    
    // Connect line from comment to block
    Blockly.utils.dom.createSvgElement(
        'path',
        {
          'd': `M ${x + width/2} ${y + height} L ${blockPos.x + block.width/2} ${blockPos.y}`,
          'stroke': '#F0D900',
          'stroke-width': 1
        },
        commentGroup);
    
    this.visibleComment_ = commentGroup;
    this.visibleCommentBlockId_ = block.id;
  }
  
  /**
   * Hide the currently visible comment.
   * @private
   */
  hideComment_() {
    if (this.visibleComment_ && this.commentGroup_) {
      this.commentGroup_.removeChild(this.visibleComment_);
      this.visibleComment_ = null;
      this.visibleCommentBlockId_ = null;
    }
  }
  
  /**
   * Get the position of a block in the workspace.
   * @param {!Blockly.Block} block The block to get position for.
   * @return {Object} The x, y coordinates of the block.
   * @private
   */
  getBlockPosition_(block) {
    if (!block.getSvgRoot()) return null;
    
    // Get absolute position within the workspace
    const xy = block.getRelativeToSurfaceXY();
    
    // Consider workspace scale and scroll
    const scale = this.workspace_.scale;
    
    return {
      x: xy.x * scale,
      y: xy.y * scale
    };
  }
  
  /**
   * Announce comment action to screen readers.
   * @param {string} message The message to announce.
   * @private
   */
  announceComment_(message) {
    if (!this.ariaLiveRegion_) return;
    this.ariaLiveRegion_.textContent = message;
  }
  
  /**
   * Clean up the comments manager.
   */
  dispose() {
    // Unregister shortcut
    this.unregisterCommentShortcut_();
    
    // Remove comment group
    if (this.commentGroup_ && this.commentGroup_.parentNode) {
      this.commentGroup_.parentNode.removeChild(this.commentGroup_);
    }
    
    // Remove ARIA live region
    if (this.ariaLiveRegion_ && this.ariaLiveRegion_.parentNode) {
      this.ariaLiveRegion_.parentNode.removeChild(this.ariaLiveRegion_);
    }
    
    this.blockComments_.clear();
    this.commentGroup_ = null;
    this.visibleComment_ = null;
    this.visibleCommentBlockId_ = null;
    this.ariaLiveRegion_ = null;
    this.initialized_ = false;
  }
}

/**
 * Initialize comments for a workspace.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to add comments to.
 * @return {!CommentsManager} The comments manager.
 */
export function initComments(workspace) {
  const commentsManager = new CommentsManager(workspace);
  commentsManager.init();
  return commentsManager;
}

/**
 * Dispose of comments on a workspace.
 * @param {!CommentsManager} commentsManager The comments manager to dispose of.
 */
export function disposeComments(commentsManager) {
  if (commentsManager) {
    commentsManager.dispose();
  }
}