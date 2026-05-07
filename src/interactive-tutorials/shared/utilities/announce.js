/**
 * Accessible announcement utilities using aria-live regions
 * Uses polite announcements to avoid interrupting screen reader speech
 */

let liveRegion = null;

/**
 * Initialize the global live region for announcements
 * Should be called once on app initialization
 */
export function initLiveRegion() {
  if (liveRegion) return liveRegion;

  liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  
  // Visually hidden but accessible to screen readers
  liveRegion.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
  
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Announce a message to screen readers
 * @param {string} message - The message to announce
 * @param {number} delay - Optional delay in ms before announcing (default: 100)
 */
export function announce(message, delay = 100) {
  if (!liveRegion) {
    initLiveRegion();
  }

  if (!message || typeof message !== 'string') {
    console.warn('announce() called with invalid message:', message);
    return;
  }

  // Clear previous announcement
  liveRegion.textContent = '';

  // Delay ensures screen readers pick up the change
  setTimeout(() => {
    liveRegion.textContent = message;
  }, delay);
}

/**
 * Announce success message
 * @param {string} message - Success message
 */
export function announceSuccess(message) {
  announce(`Success: ${message}`);
}

/**
 * Announce error message
 * @param {string} message - Error message
 */
export function announceError(message) {
  announce(`Error: ${message}`);
}

/**
 * Announce progress update
 * @param {number} current - Current step/lesson number
 * @param {number} total - Total steps/lessons
 * @param {string} context - Optional context (e.g., "lessons", "steps")
 */
export function announceProgress(current, total, context = 'items') {
  const percentage = Math.round((current / total) * 100);
  announce(`Progress: ${current} of ${total} ${context} complete. ${percentage} percent.`);
}

/**
 * Clean up live region on disposal
 */
export function disposeLiveRegion() {
  if (liveRegion && liveRegion.parentNode) {
    liveRegion.parentNode.removeChild(liveRegion);
    liveRegion = null;
  }
}
