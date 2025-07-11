/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Implements stack labeling in Blockly.
 * Each visually separate stack gets an alphabetical label (A-Z, AA-ZZ, etc.).
 */

import * as Blockly from 'blockly/core';

/**
 * Class for managing alphabetical labels for block stacks.
 * Every stack gets a label in alphabetical order.
 */
export class StackLabelManager {
  /**
   * Constructor for the StackLabelManager.
   * @param {!Blockly.WorkspaceSvg} workspace The workspace to manage stack labels for.
   */
  constructor(workspace) {
    /**
     * The workspace this manager is associated with.
     * @type {!Blockly.WorkspaceSvg}
     * @private
     */
    this.workspace_ = workspace;
    
    /**
     * Map of block IDs to their stack label elements.
     * @type {!Map<string, SVGElement>}
     * @private
     */
    this.stackLabels_ = new Map();
    
    /**
     * Map of block IDs to their stack letter labels.
     * @type {!Map<string, string>}
     * @private
     */
    this.stackLetters_ = new Map();

    /**
     * Set of all assigned labels to avoid reuse.
     * @type {!Set<string>}
     * @private
     */
    this.usedLabels_ = new Set();
    
    /**
     * The next label index to try when assigning new labels.
     * @type {number}
     * @private
     */
    this.nextLabelIndex_ = 0;
    
    /**
     * Whether the manager is currently enabled.
     * @type {boolean}
     * @private
     */
    this.enabled_ = false;

    /**
     * Bound event handlers for workspace events.
     * @type {!Array<function(!Blockly.Events.Abstract)>}
     * @private
     */
    this.boundEvents_ = [];
  }

  /**
   * Initialize the stack label manager.
   */
  init() {
    if (this.enabled_) return;
    this.enabled_ = true;
    
    // Bind event handlers
    this.bindWorkspaceEvents_();
    
    // Initialize existing stacks
    this.updateAllStackLabels_();
  }

  /**
   * Clean up the stack label manager.
   */
  dispose() {
    if (!this.enabled_) return;
    this.enabled_ = false;
    
    // Unbind event handlers
    this.unbindWorkspaceEvents_();
    
    // Remove all labels
    this.removeAllLabels_();
    
    // Clear maps
    this.stackLabels_.clear();
    this.stackLetters_.clear();
  }

  /**
   * Bind workspace events for updating stack labels.
   * @private
   */
  bindWorkspaceEvents_() {
    // Handler for block create, delete, move, change events
    const onBlockEvent = this.onBlockEvent_.bind(this);
    
    // Listen for block events
    this.workspace_.addChangeListener(onBlockEvent);
    
    // Store bound event handlers for cleanup
    this.boundEvents_.push(onBlockEvent);
  }

  /**
   * Unbind workspace events.
   * @private
   */
  unbindWorkspaceEvents_() {
    for (const handler of this.boundEvents_) {
      this.workspace_.removeChangeListener(handler);
    }
    this.boundEvents_.length = 0;
  }

  /**
   * Handle workspace events to update stack labels.
   * @param {!Blockly.Events.Abstract} event The workspace event.
   * @private
   */
  onBlockEvent_(event) {
    // Only process events on our workspace
    if (!event.workspaceId || event.workspaceId !== this.workspace_.id) return;
    
    if (event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE ||
        event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CHANGE) {
      // Use a timeout to ensure all events in this cycle are processed
      setTimeout(() => {
        // Only update if workspace still exists
        if (this.enabled_ && this.workspace_) {
          this.updateAllStackLabels_();
        }
      }, 0);
    }
  }

  /**
   * Update labels for all block stacks in the workspace.
   * @private
   */
  updateAllStackLabels_() {
    if (!this.workspace_ || !this.enabled_) return;
    
    try {
      // Track which top block IDs we've seen in this update
      const currentTopBlockIds = new Set();
      
      // Get all top-level blocks - these are the starting points for stacks
      const topBlocks = this.workspace_.getTopBlocks(true);
      if (!topBlocks) return;
      
      // Process each top block (stack)
      for (const topBlock of topBlocks) {
        // Skip blocks that aren't valid or aren't rendered
        if (!topBlock || !topBlock.rendered) continue;
        
        // Skip blocks being dragged if the method exists
        if (typeof topBlock.isDragging === 'function' && topBlock.isDragging()) continue;
        
        const blockId = topBlock.id;
        currentTopBlockIds.add(blockId);
        
        // Check if this block already has a label
        if (this.stackLetters_.has(blockId)) {
          // Re-use the existing label
          const existingLabel = this.stackLetters_.get(blockId);
          
          // Refresh the label display (it may have moved)
          this.addLabel_(topBlock, existingLabel);
          
          // Update aria attributes on all blocks in this stack
          this.updateStackBlocksAccessibility_(topBlock, existingLabel);
        } else {
          // This is a new stack that needs a label
          // Generate the next unused label
          const newLabel = this.getNextAvailableLabel_();
          
          // Add label to this stack's top block
          this.addLabel_(topBlock, newLabel);
          
          // Store the stack letter
          this.stackLetters_.set(blockId, newLabel);
          
          // Mark this label as used
          this.usedLabels_.add(newLabel);
          
          // Update all blocks in this stack with aria attributes
          this.updateStackBlocksAccessibility_(topBlock, newLabel);
        }
      }
      
      // Clean up labels for blocks that no longer exist or are no longer top blocks
      const labelsToRemove = [];
      for (const [blockId, _] of this.stackLabels_) {
        if (!currentTopBlockIds.has(blockId)) {
          labelsToRemove.push(blockId);
        }
      }
      
      // Remove obsolete labels
      for (const blockId of labelsToRemove) {
        this.removeLabel_(blockId);
      }
    } catch (e) {
      console.error('Error updating stack labels:', e);
    }
  }
  
  /**
   * Gets the next available, unused label.
   * @return {string} The next available label.
   * @private
   */
  getNextAvailableLabel_() {
    let label;
    
    // Keep trying label indices until we find an unused one
    do {
      label = this.generateAlphabeticLabel_(this.nextLabelIndex_);
      this.nextLabelIndex_++;
    } while (this.usedLabels_.has(label));
    
    return label;
  }
  
  /**
   * Generates an alphabetic Excel-style label (A-Z, then AA, AB, AC...).
   * @param {number} index The index to convert to an alphabetic label.
   * @return {string} The alphabetic label.
   * @private
   */
  generateAlphabeticLabel_(index) {
    if (index < 0) return '';
    
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let label = '';
    
    // Generate Excel-style column references
    let temp = index;
    do {
      // Get remainder for current letter position
      const remainder = temp % 26;
      // Add current letter to the label
      label = letters.charAt(remainder) + label;
      // Integer divide and subtract 1 to move to next position
      temp = Math.floor(temp / 26) - 1;
    } while (temp >= 0);
    
    return label;
  }

  /**
   * Update accessibility attributes for all blocks in a stack.
   * @param {!Blockly.BlockSvg} startBlock The top block of the stack.
   * @param {string} label The stack's label.
   * @private
   */
  updateStackBlocksAccessibility_(startBlock, label) {
    // Start with the top block
    let currentBlock = startBlock;
    
    // Process each block in the stack
    while (currentBlock) {
      this.addStackAccessibilityToBlock_(currentBlock, label);
      
      // Move to the next block in the stack
      currentBlock = this.getNextBlockInStack_(currentBlock);
    }
  }
  
  /**
   * Get the next block in a stack.
   * @param {!Blockly.BlockSvg} block The block to get the next block from.
   * @return {Blockly.BlockSvg|null} The next block or null.
   * @private
   */
  getNextBlockInStack_(block) {
    if (!block) return null;
    
    // Check if this block has a next connection with a block attached
    if (block.nextConnection && block.nextConnection.isConnected()) {
      return block.nextConnection.targetBlock();
    }
    
    return null;
  }

  /**
   * Add a stack label to a block.
   * @param {!Blockly.BlockSvg} block The block to add a label to (top of stack).
   * @param {string} label The label to display.
   * @private
   */
  addLabel_(block, label) {
    // Remove any existing label
    this.removeLabel_(block.id);
    
    // Create the label
    const labelElement = this.createLabelElement_(label);
    
    try {
      const blockSvg = block.getSvgRoot();
      if (blockSvg) {
        // Get the block's parent group
        const blockGroup = blockSvg.parentNode;
        if (blockGroup) {
          // Insert the label before the block SVG
          blockGroup.insertBefore(labelElement, blockSvg);
          
          // Position the label above the block
          this.positionLabelAboveBlock_(labelElement, block);
          
          // Store the label for later removal
          this.stackLabels_.set(block.id, labelElement);
        }
      }
    } catch (e) {
      console.warn('Could not add stack label to block', e);
    }
  }
  
  /**
   * Position the label above a block.
   * @param {!SVGElement} labelElement The label element.
   * @param {!Blockly.BlockSvg} block The block to position above.
   * @private
   */
  positionLabelAboveBlock_(labelElement, block) {
    try {
      // Get block position
      const blockBox = block.getBoundingRectangle();
      
      // Determine label dimensions
      const labelRect = labelElement.querySelector('rect');
      const labelHeight = parseFloat(labelRect.getAttribute('height') || '22');
      
      // Calculate position
      // Align with block number position (typically at the top-right corner)
      // but slightly to the left (2px)
      const x = blockBox.left + 2;  // Aligned with or 2px left of block number badge
      
      // Position the bottom edge of the label 5px above the block's top edge
      // This gives 5px clearance from the top of the block
      const y = blockBox.top - 5 - labelHeight; // Bottom of label is 5px above block top
      
      // Apply the position
      labelElement.setAttribute('transform', `translate(${x}, ${y})`);
    } catch (e) {
      console.warn('Could not position stack label', e);
      
      // Simple fallback if the above fails
      try {
        const blockBox = block.getBoundingRectangle();
        const x = blockBox.left;
        const y = blockBox.top - 26; // Approximately label height + 4px gap
        labelElement.setAttribute('transform', `translate(${x}, ${y})`);
      } catch (innerError) {
        console.warn('Fallback positioning failed', innerError);
      }
    }
  }

  /**
   * Create an SVG element with a stack label.
   * @param {string} label The label text.
   * @return {!SVGElement} The label element.
   * @private
   */
  createLabelElement_(label) {
    const NS = Blockly.utils.dom.SVG_NS;
    
    // Create a group to hold the label
    const g = document.createElementNS(NS, 'g');
    g.classList.add('blockly-stack-label');
    
    // Fixed width calculation based on text length - avoid dynamic calculations
    const width = 16 + label.length * 10;
    
    // Create the label background
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('rx', '4');
    rect.setAttribute('ry', '4');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', '22');
    rect.setAttribute('fill', '#4285F4');
    rect.setAttribute('stroke', '#3267D6');
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);
    
    // Create the text label with right alignment to be closer to the block
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', String(width - 6));
    text.setAttribute('y', '16');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', 'white');
    text.setAttribute('text-anchor', 'end'); // Right-align text
    text.textContent = label;
    g.appendChild(text);
    
    return g;
  }

  /**
   * Add accessibility attributes to a block for its stack label.
   * @param {!Blockly.BlockSvg} block The block to add accessibility to.
   * @param {string} stackLabel The stack's label.
   * @private
   */
  addStackAccessibilityToBlock_(block, stackLabel) {
    try {
      // Get the block's text
      const blockText = typeof block.toString === 'function' ? 
          block.toString(undefined, ' ').trim() : 'Block';
      
      // Get existing ARIA label if any
      const svgRoot = block.getSvgRoot();
      if (!svgRoot) return;
      
      let ariaLabel = svgRoot.getAttribute('aria-label') || blockText;
      
      // Check if the stack label is already in the ARIA label
      if (!ariaLabel.includes(`Stack ${stackLabel}:`)) {
        // Add stack label to the beginning of the ARIA label
        ariaLabel = `Stack ${stackLabel}: ${ariaLabel}`;
        svgRoot.setAttribute('aria-label', ariaLabel);
      }
    } catch (e) {
      // Fail quietly if can't set ARIA label
      console.warn('Could not set stack label ARIA attribute', e);
    }
  }

  /**
   * Remove a label from a block.
   * @param {string} blockId The ID of the block to remove a label from.
   * @private
   */
  removeLabel_(blockId) {
    const label = this.stackLabels_.get(blockId);
    if (label && label.parentNode) {
      label.parentNode.removeChild(label);
    }
    this.stackLabels_.delete(blockId);
  }

  /**
   * Remove all labels from the workspace.
   * @private
   */
  removeAllLabels_() {
    for (const [blockId, label] of this.stackLabels_.entries()) {
      if (label && label.parentNode) {
        label.parentNode.removeChild(label);
      }
    }
    this.stackLabels_.clear();
  }

  /**
   * Get the stack label for a block.
   * @param {string} blockId The ID of the block.
   * @return {string|undefined} The stack label or undefined if not found.
   */
  getStackLabel(blockId) {
    // First check if this is a top block
    if (this.stackLetters_.has(blockId)) {
      return this.stackLetters_.get(blockId);
    }
    
    // If not a top block, find which stack it belongs to
    // This is a simplified approach - in practice we'd want to traverse up
    // to find the top block of the stack this block belongs to
    return undefined;
  }

  /**
   * Update the stack labels when a workspace event occurs.
   * Public method that can be called externally.
   */
  update() {
    this.updateAllStackLabels_();
  }
}

/**
 * Singleton instance of the StackLabelManager.
 * @type {StackLabelManager}
 */
let stackLabelManagerInstance = null;

/**
 * Initialize stack labels for a workspace.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to initialize labels on.
 * @return {!StackLabelManager} The stack label manager instance.
 */
export function initStackLabels(workspace) {
  if (!stackLabelManagerInstance) {
    stackLabelManagerInstance = new StackLabelManager(workspace);
    stackLabelManagerInstance.init();
  }
  return stackLabelManagerInstance;
}

/**
 * Dispose of the stack label manager.
 */
export function disposeStackLabels() {
  if (stackLabelManagerInstance) {
    stackLabelManagerInstance.dispose();
    stackLabelManagerInstance = null;
  }
}
