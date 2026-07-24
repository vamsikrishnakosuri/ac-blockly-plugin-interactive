/**
 * Wires the app menu's "Beginner" mode to the LessonRunner component.
 *
 * Loaded as a native ES module (type="module"). The runner deliberately does NOT
 * import lessons.json itself — a static JSON import needs an import attribute
 * (`with { type: 'json' }`) that not every loader accepts. Instead this shim
 * fetches lessons.json relative to its own URL and injects the data, so the same
 * runner code works under a bundler and as a raw module in this demo.
 *
 * Beginner mode is an audio + keyboard guide (no visual panel): it speaks each
 * step, watches what the learner builds (window.workspace), and auto-advances
 * when each step's deterministic success criterion becomes true. Its on-demand
 * visible step view reuses the demo's existing instructions overlay, so we pass
 * a getInstructions accessor through to the runner.
 */

import { LessonRunner } from '../../../src/interactive-tutorials/beginner/lesson-runner.js';
import { announce } from '../../../src/interactive-tutorials/shared/utilities/announce.js';

const LESSONS_URL = new URL(
  '../../../src/interactive-tutorials/beginner/lessons.json',
  import.meta.url
);

let runner = null;
let lessonsPromise = null;

function loadLessons() {
  if (!lessonsPromise) {
    lessonsPromise = fetch(LESSONS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        lessonsPromise = null; // allow a retry on next launch
        throw err;
      });
  }
  return lessonsPromise;
}

/**
 * Toggle Beginner mode. Lazily fetches lessons and builds the runner on first
 * launch, then opens/closes the panel on subsequent calls.
 */
async function toggleBeginnerMode() {
  if (runner && runner.isOpen()) {
    runner.close();
    return;
  }
  try {
    const lessons = await loadLessons();
    if (!runner) {
      runner = new LessonRunner({
        lessons,
        getWorkspace: () => window.workspace,
        getInstructions: () => window.instructionsManager
      });
      window.beginnerMode = runner;
    }
    runner.open();
  } catch (err) {
    announce('Beginner mode could not start. Please try again.', { assertive: true });
    // eslint-disable-next-line no-console
    console.error('Beginner mode failed to load lessons:', err);
  }
}

// Expose for the app menu (and debugging / future integration).
window.beginnerModeToggle = toggleBeginnerMode;
