/**
 * @license
 * Copyright 2025 Vamsi
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Manages the instructions overlay for displaying task scenarios.
 * Provides an info button that opens instructions for the current program.
 */

/**
 * Class for managing instructions overlay display.
 */
export class InstructionsOverlayManager {
  /**
   * Constructor for the InstructionsOverlayManager.
   * @param {Object} options Configuration options
   * @param {string} options.instructionsBasePath Base path to instructions HTML files
   */
  constructor(options = {}) {
    this.instructionsBasePath = options.instructionsBasePath || 'xml/instructions/';
    this.currentProgramId = null;
    this.isVisible = false;
    this.overlayElement = null;
    this.boundKeyHandler = null;
    this.currentItemIndex = 0;
    this.navigableItems = [];
    
    console.log('Instructions overlay: Initialized');
  }

  /**
   * Initialize the instructions overlay manager.
   */
  init() {
    this.createOverlayElement();
    this.bindKeyboardHandlers();
    console.log('Instructions overlay: Ready');
  }

  /**
   * Create the overlay DOM element.
   * @private
   */
  createOverlayElement() {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'instructions-overlay';
    overlay.setAttribute('role', 'application');
    overlay.setAttribute('aria-roledescription', 'Instructions dialog');
    overlay.setAttribute('aria-label', 'Task Instructions - Use W and S keys to navigate');
    overlay.setAttribute('tabindex', '0');
    overlay.style.display = 'none';

    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'instructions-overlay-content';

    // Create header
    const header = document.createElement('div');
    header.className = 'instructions-overlay-header';

    const title = document.createElement('h2');
    title.id = 'instructions-title';
    title.className = 'instructions-overlay-title';
    title.textContent = 'Task Instructions';

    const closeButton = document.createElement('button');
    closeButton.className = 'instructions-overlay-close';
    closeButton.setAttribute('aria-label', 'Close instructions');
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create body
    const body = document.createElement('div');
    body.className = 'instructions-overlay-body';
    body.id = 'instructions-content';
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', 'Task instructions content');

    // Create footer
    const footer = document.createElement('div');
    footer.className = 'instructions-overlay-footer';
    footer.innerHTML = '<p class="instructions-hint"><kbd>W</kbd>/<kbd>S</kbd> to navigate • <kbd>Esc</kbd> to close • <small>NVDA: Press <kbd>NVDA+Space</kbd> if keys don\'t work</small></p>';

    // Create live region for screen reader announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'visually-hidden';

    // Assemble
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    overlay.appendChild(content);
    overlay.appendChild(liveRegion);

    // Add to document
    document.body.appendChild(overlay);
    this.overlayElement = overlay;

    console.log('Instructions overlay: Overlay element created');
  }

  /**
   * Bind keyboard event handlers.
   * @private
   */
  bindKeyboardHandlers() {
    this.boundKeyHandler = (event) => {
      if (!this.isVisible) return;

      const key = event.key.toUpperCase();

      // Escape to close
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.hide();
        return;
      }

      // W key - Navigate to previous item
      if (key === 'W') {
        event.preventDefault();
        event.stopPropagation();
        this.navigateToPrevious();
        return;
      }

      // S key - Navigate to next item
      if (key === 'S') {
        event.preventDefault();
        event.stopPropagation();
        this.navigateToNext();
        return;
      }

      // Arrow keys for alternative navigation
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.navigateToPrevious();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.navigateToNext();
        return;
      }

      // Page Up/Down for faster scrolling
      if (event.key === 'PageUp') {
        event.preventDefault();
        this.scrollContent(-400);
        return;
      }

      if (event.key === 'PageDown') {
        event.preventDefault();
        this.scrollContent(400);
        return;
      }

      // Home - Scroll to top
      if (event.key === 'Home') {
        event.preventDefault();
        const contentElement = document.getElementById('instructions-content');
        contentElement.scrollTop = 0;
        return;
      }

      // End - Scroll to bottom
      if (event.key === 'End') {
        event.preventDefault();
        const contentElement = document.getElementById('instructions-content');
        contentElement.scrollTop = contentElement.scrollHeight;
        return;
      }
    };

    document.addEventListener('keydown', this.boundKeyHandler, true);
  }

  /**
   * Scroll the instructions content by a specified amount.
   * @param {number} amount Scroll amount in pixels (positive = down, negative = up)
   * @private
   */
  scrollContent(amount) {
    const contentElement = document.getElementById('instructions-content');
    if (contentElement) {
      contentElement.scrollBy({
        top: amount,
        behavior: 'smooth'
      });
      console.log(`Instructions overlay: Scrolled by ${amount}px`);
    }
  }

  /**
   * Build list of navigable items from the instructions content.
   * @private
   */
  buildNavigableItems() {
    const contentElement = document.getElementById('instructions-content');
    if (!contentElement) return;

    // Convert complex HTML to simple list
    this.simplifyContent(contentElement);

    // Select all navigable elements (now simplified)
    this.navigableItems = Array.from(contentElement.querySelectorAll('.instruction-item'));

    // Add tabindex and aria attributes
    this.navigableItems.forEach((item, index) => {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Item ${index + 1} of ${this.navigableItems.length}: ${item.textContent.trim()}`);
    });

    this.currentItemIndex = 0;
    console.log(`Instructions overlay: Built ${this.navigableItems.length} navigable items`);
  }

  /**
   * Simplify HTML content to plain text list for better screen reader support.
   * @param {HTMLElement} contentElement The content container
   * @private
   */
  simplifyContent(contentElement) {
    // Find all scenarios
    const scenarios = contentElement.querySelectorAll('.scenario');
    
    // Create a simple list container
    const listContainer = document.createElement('div');
    listContainer.className = 'instructions-simple-list';
    listContainer.setAttribute('role', 'list');

    let itemNumber = 1;

    scenarios.forEach((scenario, scenarioIndex) => {
      // Get scenario data
      const title = scenario.querySelector('.scenario-title')?.textContent.trim() || '';
      const goal = scenario.querySelector('.scenario-goal')?.textContent.trim() || '';
      const steps = Array.from(scenario.querySelectorAll('.scenario-steps li'));
      const completion = scenario.querySelector('.scenario-completion')?.textContent.trim() || '';
      const feedback = scenario.querySelector('.scenario-feedback')?.textContent.trim() || '';

      // Add title
      if (title) {
        const titleItem = this.createSimpleItem(itemNumber++, title, 'title');
        listContainer.appendChild(titleItem);
      }

      // Add goal
      if (goal) {
        const goalItem = this.createSimpleItem(itemNumber++, goal, 'goal');
        listContainer.appendChild(goalItem);
      }

      // Add steps
      steps.forEach((step, stepIndex) => {
        const stepText = `Step ${stepIndex + 1}: ${step.textContent.trim()}`;
        const stepItem = this.createSimpleItem(itemNumber++, stepText, 'step');
        listContainer.appendChild(stepItem);
      });

      // Add completion
      if (completion) {
        const completionItem = this.createSimpleItem(itemNumber++, completion, 'completion');
        listContainer.appendChild(completionItem);
      }

      // Add feedback
      if (feedback) {
        const feedbackItem = this.createSimpleItem(itemNumber++, feedback, 'feedback');
        listContainer.appendChild(feedbackItem);
      }

      // Add separator between scenarios (except last one)
      if (scenarioIndex < scenarios.length - 1) {
        const separator = document.createElement('div');
        separator.className = 'instruction-separator';
        listContainer.appendChild(separator);
      }
    });

    // Replace content with simplified version
    contentElement.innerHTML = '';
    contentElement.appendChild(listContainer);
  }

  /**
   * Create a simple instruction item.
   * @param {number} number Item number
   * @param {string} text Item text
   * @param {string} type Item type (title, goal, step, completion, feedback)
   * @return {HTMLElement} The created item
   * @private
   */
  createSimpleItem(number, text, type) {
    const item = document.createElement('div');
    item.className = `instruction-item instruction-${type}`;
    item.setAttribute('role', 'listitem');
    item.textContent = text;
    return item;
  }

  /**
   * Navigate to the previous item.
   * @private
   */
  navigateToPrevious() {
    if (this.navigableItems.length === 0) return;

    this.currentItemIndex = Math.max(0, this.currentItemIndex - 1);
    this.highlightCurrentItem();
  }

  /**
   * Navigate to the next item.
   * @private
   */
  navigateToNext() {
    if (this.navigableItems.length === 0) return;

    this.currentItemIndex = Math.min(this.navigableItems.length - 1, this.currentItemIndex + 1);
    this.highlightCurrentItem();
  }

  /**
   * Highlight the current item and announce it to screen readers.
   * @private
   */
  highlightCurrentItem() {
    if (this.navigableItems.length === 0) return;

    // Remove highlight from all items
    this.navigableItems.forEach(item => {
      item.classList.remove('instructions-highlighted');
      item.setAttribute('aria-current', 'false');
      item.setAttribute('tabindex', '-1');
    });

    // Highlight current item
    const currentItem = this.navigableItems[this.currentItemIndex];
    currentItem.classList.add('instructions-highlighted');
    currentItem.setAttribute('aria-current', 'location');
    currentItem.setAttribute('tabindex', '0');

    // Scroll item into view
    currentItem.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Focus the element for screen readers with a delay
    setTimeout(() => {
      currentItem.focus({ preventScroll: true });
    }, 50);

    // Announce to screen reader
    const text = currentItem.textContent.trim();
    const announcement = `Navigating. Item ${this.currentItemIndex + 1} of ${this.navigableItems.length}. ${text}`;
    this.announceToScreenReader(announcement);

    console.log(`Instructions overlay: Highlighted item ${this.currentItemIndex + 1} of ${this.navigableItems.length}`);
  }

  /**
   * Announce text to screen readers.
   * @param {string} text Text to announce
   * @private
   */
  announceToScreenReader(text) {
    const liveRegion = this.overlayElement.querySelector('[aria-live="assertive"]');
    if (liveRegion) {
      // Clear first to ensure NVDA picks up the change
      liveRegion.textContent = '';
      
      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          liveRegion.textContent = text;
          console.log('Announced to screen reader:', text);
        }, 150);
      });
    }
  }

  /**
   * Set the current program ID and update button state.
   * @param {string} programId The program ID to set
   */
  async setProgramId(programId) {
    this.currentProgramId = programId;
    console.log('Instructions overlay: Program ID set to', programId);
    
    // Check if instructions exist and update button state
    await this.updateButtonState();
  }

  /**
   * Check if instructions exist and update button state.
   * @private
   */
  async updateButtonState() {
    const button = document.getElementById('showInstructions');
    if (!button) return;

    // Check if we have a valid program ID
    if (!this.currentProgramId || this.currentProgramId === 'Default') {
      this.disableButton(button, 'No program selected');
      return;
    }

    // Try to check if instructions file exists
    try {
      const path = `${this.instructionsBasePath}${this.currentProgramId}.html`;
      const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
      
      if (response.ok) {
        this.enableButton(button);
      } else {
        this.disableButton(button, 'No instructions available for this program');
      }
    } catch (error) {
      // If HEAD fails, try GET (some servers don't support HEAD)
      try {
        const path = `${this.instructionsBasePath}${this.currentProgramId}.html`;
        const response = await fetch(path, { cache: 'no-store' });
        
        if (response.ok) {
          this.enableButton(button);
        } else {
          this.disableButton(button, 'No instructions available for this program');
        }
      } catch {
        this.disableButton(button, 'No instructions available for this program');
      }
    }
  }

  /**
   * Disable the instructions button.
   * @param {HTMLElement} button The button element
   * @param {string} reason Reason for disabling
   * @private
   */
  disableButton(button, reason) {
    button.disabled = true;
    button.classList.add('info-button-disabled');
    button.setAttribute('title', reason);
    button.setAttribute('aria-label', reason);
    console.log('Instructions button: Disabled -', reason);
  }

  /**
   * Enable the instructions button.
   * @param {HTMLElement} button The button element
   * @private
   */
  enableButton(button) {
    button.disabled = false;
    button.classList.remove('info-button-disabled');
    button.setAttribute('title', 'Show task instructions');
    button.setAttribute('aria-label', 'Show task instructions');
    console.log('Instructions button: Enabled');
  }

  /**
   * Show the instructions overlay.
   */
  async show() {
    if (!this.currentProgramId || this.currentProgramId === 'Default') {
      this.showNoInstructionsMessage();
      return;
    }

    try {
      // Load instructions for current program
      const instructions = await this.loadInstructions(this.currentProgramId);
      
      // Update content
      const contentElement = document.getElementById('instructions-content');
      contentElement.innerHTML = instructions;

      // Build navigable items
      this.buildNavigableItems();

      // Show overlay
      this.overlayElement.style.display = 'flex';
      this.isVisible = true;

      // Focus the overlay for accessibility - must wait for display
      setTimeout(() => {
        // Force focus on the overlay to trigger NVDA focus mode
        this.overlayElement.focus();
        
        // Double-check focus (sometimes needed for NVDA)
        if (document.activeElement !== this.overlayElement) {
          console.log('Retrying focus for NVDA');
          setTimeout(() => {
            this.overlayElement.focus();
          }, 50);
        }
        
        // Announce instructions
        this.announceToScreenReader('Instructions dialog opened. Use W and S keys to navigate through items. Press Escape to close.');
        
        // Highlight first item after announcement
        if (this.navigableItems.length > 0) {
          setTimeout(() => {
            this.highlightCurrentItem();
          }, 500);
        }
      }, 100);

      console.log('Instructions overlay: Shown for program', this.currentProgramId);
    } catch (error) {
      console.error('Instructions overlay: Error loading instructions', error);
      this.showErrorMessage();
    }
  }

  /**
   * Hide the instructions overlay.
   */
  hide() {
    if (!this.isVisible) return;

    this.overlayElement.style.display = 'none';
    this.isVisible = false;

    console.log('Instructions overlay: Hidden');
  }

  /**
   * Toggle the instructions overlay visibility.
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Load instructions from HTML file.
   * @param {string} programId The program ID
   * @return {Promise<string>} The instructions HTML
   * @private
   */
  async loadInstructions(programId) {
    const path = `${this.instructionsBasePath}${programId}.html`;
    
    const response = await fetch(path, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`Failed to load instructions: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Show a message when no instructions are available.
   * @private
   */
  showNoInstructionsMessage() {
    const contentElement = document.getElementById('instructions-content');
    contentElement.innerHTML = `
      <div class="instructions-message">
        <i class="fas fa-info-circle"></i>
        <h3>No Program Selected</h3>
        <p>Please select a program from the dropdown to view its instructions.</p>
      </div>
    `;

    this.overlayElement.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Show an error message.
   * @private
   */
  showErrorMessage() {
    const contentElement = document.getElementById('instructions-content');
    contentElement.innerHTML = `
      <div class="instructions-message instructions-error">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Instructions Not Found</h3>
        <p>Could not load instructions for this program.</p>
      </div>
    `;

    this.overlayElement.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Clean up and remove event listeners.
   */
  dispose() {
    if (this.boundKeyHandler) {
      document.removeEventListener('keydown', this.boundKeyHandler, true);
    }

    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
    }

    console.log('Instructions overlay: Disposed');
  }
}

/**
 * Initialize and return an instructions overlay manager.
 * @param {Object} options Configuration options
 * @return {InstructionsOverlayManager} The manager instance
 */
export function initInstructionsOverlay(options = {}) {
  const manager = new InstructionsOverlayManager(options);
  manager.init();
  return manager;
}
