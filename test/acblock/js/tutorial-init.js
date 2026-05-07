/**
 * Tutorial Mode Initialization
 * Standalone mode selector without plugin dependencies
 */

let selectedMode = null;

/**
 * Initialize tutorial mode selector on page load
 */
function initTutorialSelector() {
  showInlineModeSelector();
}

/**
 * Show inline mode selector (standalone version)
 */
function showInlineModeSelector() {
  const overlay = document.createElement('div');
  overlay.id = 'mode-selector-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 24px;
  `;

  overlay.innerHTML = `
    <header style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 2rem; margin: 0 0 8px 0; color: #212529;">Choose Your Learning Mode</h1>
      <p style="font-size: 1.125rem; color: #6c757d; margin: 0;">Use <strong>A/D</strong> to navigate, <strong>Enter</strong> to select</p>
    </header>
    <div id="mode-tiles" style="display: flex; gap: 24px; justify-content: center; max-width: 1200px;">
      <button class="mode-tile" data-mode="easy" style="background: #e6f2ff; border: 3px solid #0066cc; border-radius: 12px; padding: 32px; width: 320px; cursor: pointer; text-align: left;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🎓</div>
        <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #212529;">Easy Mode</h2>
        <p style="margin: 0 0 16px 0; color: #6c757d; line-height: 1.75;">Learn block programming step by step. Blocks and keyboard commands unlock progressively.</p>
        <ul style="margin: 0; padding-left: 24px; color: #6c757d; font-size: 0.875rem;">
          <li style="margin-bottom: 4px;">Progressive unlocking</li>
          <li style="margin-bottom: 4px;">8 guided lessons</li>
          <li>Hints on request</li>
        </ul>
      </button>
      <button class="mode-tile" data-mode="intermediate" style="background: #f8f9fa; border: 3px solid #dee2e6; border-radius: 12px; padding: 32px; width: 320px; cursor: pointer; text-align: left;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🔧</div>
        <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #212529;">Intermediate Mode</h2>
        <p style="margin: 0 0 16px 0; color: #6c757d; line-height: 1.75;">Full toolbox and keyboard available. Focus on programming concepts.</p>
        <ul style="margin: 0; padding-left: 24px; color: #6c757d; font-size: 0.875rem;">
          <li style="margin-bottom: 4px;">All blocks available</li>
          <li style="margin-bottom: 4px;">Concept-focused lessons</li>
          <li>No artificial limits</li>
        </ul>
      </button>
      <button class="mode-tile" data-mode="expert" style="background: #f8f9fa; border: 3px solid #dee2e6; border-radius: 12px; padding: 32px; width: 320px; cursor: pointer; text-align: left;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🚀</div>
        <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #212529;">Expert Mode</h2>
        <p style="margin: 0 0 16px 0; color: #6c757d; line-height: 1.75;">Standard Blockly sandbox with full accessibility features. No tutorials.</p>
        <ul style="margin: 0; padding-left: 24px; color: #6c757d; font-size: 0.875rem;">
          <li style="margin-bottom: 4px;">Full Blockly workspace</li>
          <li style="margin-bottom: 4px;">All keyboard shortcuts</li>
          <li>Free experimentation</li>
        </ul>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const tiles = overlay.querySelectorAll('.mode-tile');
  let currentIndex = 0;

  function updateSelection() {
    tiles.forEach((tile, i) => {
      if (i === currentIndex) {
        tile.style.borderColor = '#0066cc';
        tile.style.backgroundColor = '#e6f2ff';
        tile.style.transform = 'scale(1.02)';
        tile.focus();
      } else {
        tile.style.borderColor = '#dee2e6';
        tile.style.backgroundColor = '#f8f9fa';
        tile.style.transform = 'scale(1)';
      }
    });
  }

  function selectMode() {
    const mode = tiles[currentIndex].dataset.mode;
    selectedMode = mode;
    overlay.remove();
    handleModeSelection(mode);
  }

  // Keyboard navigation
  overlay.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
      case 'a':
      case 'arrowleft':
        e.preventDefault();
        currentIndex = Math.max(0, currentIndex - 1);
        updateSelection();
        break;
      case 'd':
      case 'arrowright':
        e.preventDefault();
        currentIndex = Math.min(tiles.length - 1, currentIndex + 1);
        updateSelection();
        break;
      case 'enter':
      case ' ':
        e.preventDefault();
        selectMode();
        break;
    }
  });

  // Click handlers
  tiles.forEach((tile, i) => {
    tile.addEventListener('click', () => {
      currentIndex = i;
      selectMode();
    });
  });

  updateSelection();
}

/**
 * Handle mode selection
 */
function handleModeSelection(modeId) {
  console.log('Selected mode:', modeId);
  selectedMode = modeId;

  // Initialize workspace
  if (typeof initWorkspace === 'function') {
    initWorkspace();
  }
}

// DOM is ready since this script is at end of body
initTutorialSelector();
