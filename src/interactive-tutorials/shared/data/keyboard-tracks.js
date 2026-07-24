/**
 * Keyboard Trainer track definitions.
 *
 * These tracks are a CURATED teaching layer over the canonical shortcut list in
 * `src/constants.js` (SHORTCUT_HELP_ROWS). We do not feed the raw rows into the
 * trainer because:
 *   1. The raw list contains ambiguous duplicates (e.g. Shift+W maps to both
 *      "move statement block up" and "move the workspace marker up"). A learner
 *      practising "Shift+W" could not tell which one fired. We resolve this by
 *      TEACHING THE TWO MEANINGS IN DIFFERENT CONTEXTS: the workspace marker in
 *      the Navigation track, the block move in the Editing track, and we verify
 *      the block move by watching the real workspace actually change.
 *   2. Most shortcuts are only meaningful with a live workspace + a cursor on a
 *      block. Those run as "live coach" steps (a `live` descriptor) and are
 *      confirmed from real editor state; the rest fall back to rehearsal.
 *
 * TWO TRACKS, by intent (from the BVI co-design sessions), each a deliberately
 * ORDERED arc that moves the learner through real scenes on the canvas (see
 * `scene` on each move and PRACTICE_SCENES in practice-programs.js) — not a flat
 * bag of shortcuts. Every move is something a sighted learner can also sit and
 * practise, so the curriculum is honest for everyone:
 *
 *   - Navigation — read and explore WITHOUT changing the program. The arc starts
 *     on an EMPTY canvas: turn keyboard mode on (Ctrl+Shift+K), glide the marker
 *     over blank space (Shift+WASD), open and close the toolbox (T / Esc), and
 *     place your first block from it. The canvas then becomes a TWO-STACK program
 *     (an if-else stack and a while stack) and the learner walks it: cursor moves
 *     (W/A/S/D), nest in and out (F/Q), jump across stacks (Opt+Shift+G), open the
 *     shortcuts list (Shift+K) and the navigational assistant (Shift+H), then run
 *     (Shift+R) and hear output (Shift+O).
 *   - Editing — CHANGE the two-stack program. Edit mode (E), move a block up or
 *     down (Shift+W/S), disconnect (Shift+X), cut / copy / paste (Ctrl+X, Ctrl+C,
 *     Ctrl+V), delete, comment (Ctrl+/), reach into a block's inner property
 *     (Shift+F), label a whole stack (Shift+I) and fast-travel to it (Opt+letter).
 *
 * SCENES:
 *   Each move carries a `scene` id ('empty' or 'twoStack'). The trainer lays that
 *   scene on the real canvas before the drill so what the learner hears described
 *   matches what their keypress will act on. Scene swaps reuse one stash of the
 *   learner's own blocks, restored intact when they leave.
 *
 * VERIFICATION, honestly:
 *   - Cursor moves are confirmed with `cursorMoved` (the cursor's node id
 *     changes).
 *   - Edits are confirmed with `workspaceChanged` (the serialized workspace
 *     changes) — one cheap probe that covers move/disconnect/cut/paste/delete/
 *     comment regardless of which key did it.
 *   - Steps whose effect is transient UI we cannot read (toggling Edit mode with
 *     E, opening the label editor with Shift+I, moving the marker over empty
 *     canvas) are taught as REHEARSAL: we confirm the keystroke, not a fake
 *     editor change. Better an honest "you pressed the right key" than a probe
 *     that guesses.
 *
 * The terse `instruction` is tuned for spoken delivery (audio-first). The
 * detailed verbosity tier reuses the canonical `sr` string from
 * SHORTCUT_HELP_ROWS via `helpRow` (a deliberate index, chosen to avoid the
 * duplicate signatures) so reference wording never drifts from the real plugin.
 *
 * SEARCH / RANDOM ACCESS:
 *   Every move carries a `keywords` array — concept synonyms in the learner's
 *   own words (seeded from the BVI co-design vocabulary: "stack labels", "cursor
 *   location", "3d navigation", "where am I"). This is what powers the trainer's
 *   "jump to what you want to learn" search: a learner who does not know that
 *   nesting-in is F can type "nest" and reach it. Both nesting moves share the
 *   "nest" keyword on purpose, so one query surfaces F (in) AND Q (out). See
 *   `searchShortcuts()` below. The synonyms are content, not code — extend them
 *   freely as we learn how people actually ask.
 */

import { SHORTCUT_HELP_ROWS } from '../../../constants.js';

/**
 * Pull the canonical screen-reader description for the detailed verbosity tier.
 * @param {number} index - Deliberate index into SHORTCUT_HELP_ROWS.
 * @returns {string}
 */
export function canonicalDetail(index) {
  const row = SHORTCUT_HELP_ROWS[index];
  return row ? row.sr : '';
}

/**
 * A detection signature describes the keydown we listen for.
 *   code  - KeyboardEvent.code (layout-robust, unaffected by Shift)
 *   shift - Shift must be held
 *   mod   - Ctrl (Win/Linux) OR Cmd (Mac) must be held
 *   alt   - Alt/Option must be held
 *   key   - exact KeyboardEvent.key (used for non-letter keys like Escape)
 * Unspecified modifiers must be ABSENT for a match (strict matching).
 */

export const KEYBOARD_TRACKS = [
  // ===========================================================================
  // TRACK 1 — NAVIGATION: read and explore without changing the program.
  // ===========================================================================
  {
    id: 'track-navigation',
    title: 'Navigation',
    description:
      'Read and explore a program without changing it. The arc starts on an empty ' +
      'canvas: turn keyboard mode on, glide the marker over blank space, open and ' +
      'close the toolbox, and place your first block. The canvas then becomes a ' +
      'small two-stack program — an if-else stack and a while-loop stack — and you ' +
      'walk it: move the cursor between blocks, step in and out of nested blocks, ' +
      'jump across stacks, open the shortcuts list and the navigational assistant, ' +
      'then run the program and hear its output. Every key always has something ' +
      'real to act on.',
    requiresSandbox: true,
    shortcuts: [
      // --- SCENE: empty canvas -------------------------------------------------
      {
        id: 'enable-keyboard-nav',
        label: 'Turn keyboard mode on or off',
        keywords: ['keyboard mode', 'keyboard navigation', 'accessibility', 'enable',
          'turn on', 'switch on', 'keyboard access', 'start keyboard', 'on off',
          'activate keyboard', 'keyboard accessibility'],
        keyHint: 'Control plus Shift plus K',
        instruction:
          'Everything else in this trainer depends on keyboard mode being on. It ' +
          'puts a movable cursor on the canvas and routes the shortcut keys to the ' +
          'editor. Hold Control, Shift, and K together to toggle it. The canvas is ' +
          'empty right now — press Control plus Shift plus K to turn keyboard mode ' +
          'on.',
        detect: { code: 'KeyK', ctrl: true, shift: true },
        helpRow: 32,
        mode: 'any',
        scene: 'empty',
        // The trainer turns keyboard nav OFF just before this drill (disableNavFirst)
        // so the learner's own keypress flips it ON — a real, observable toggle we
        // confirm from editor state rather than trusting the keystroke.
        live: {
          focus: 'workspace',
          disableNavFirst: true,
          confirm: 'keyboardNavOn',
          cue: 'Keyboard mode is now on — a cursor is on the canvas.'
        },
        success:
          'Keyboard mode is on. The same Control plus Shift plus K turns it off ' +
          'again. Leave it on for the rest of the trainer.'
      },
      {
        id: 'move-workspace-marker',
        label: 'Move the workspace marker',
        keywords: ['marker', 'move marker', 'glide', 'point', 'aim', 'empty space',
          'blank canvas', 'where to build', 'position', 'spot', 'cursor on canvas'],
        keyHint: 'Shift plus W, A, S, D',
        instruction:
          'Hold Shift and press W, A, S, or D to glide the workspace marker around ' +
          'the canvas — up, left, down, right — even over empty space where there ' +
          'are no blocks. It is how you point at a spot before you build there. We ' +
          'will try all four directions in turn, and each one is called out as you ' +
          'go.',
        // Rehearsed as a four-direction drill so each key gets its own spoken
        // confirmation (up / left / down / right). It stays rehearsal rather than
        // live because the same Shift keys move a SELECTED BLOCK when the cursor
        // is on one — the marker only glides over empty canvas — so there is no
        // single live state we can honestly verify here. The Editing track teaches
        // the block-moving meaning of Shift+W and Shift+S.
        sequence: [
          {
            detect: { code: 'KeyW', shift: true },
            prompt: 'Hold Shift and press W to move the marker up.',
            done: 'Marker up.'
          },
          {
            detect: { code: 'KeyA', shift: true },
            prompt: 'Now hold Shift and press A to move the marker left.',
            done: 'Marker left.'
          },
          {
            detect: { code: 'KeyS', shift: true },
            prompt: 'Now hold Shift and press S to move the marker down.',
            done: 'Marker down.'
          },
          {
            detect: { code: 'KeyD', shift: true },
            prompt: 'Now hold Shift and press D to move the marker right.',
            done: 'Marker right.'
          }
        ],
        helpRow: 22,
        mode: 'navigation',
        scene: 'empty',
        success:
          'Marker right. That is the workspace marker — Shift with W, A, S, or D ' +
          'glides it up, left, down, and right around the canvas. With a block ' +
          'selected, the same Shift keys move the block instead; you will meet that ' +
          'in the Editing track.'
      },
      {
        id: 'toolbox-open-close',
        label: 'Open and close the toolbox',
        keywords: ['toolbox', 'blocks menu', 'palette', 'open toolbox', 'add blocks',
          'categories', 'flyout', 'library', 'block list', 'menu of blocks'],
        keyHint: 'T, then Escape',
        instruction:
          'The toolbox is the menu of blocks you can add. Two keys work as a pair: ' +
          'T opens it, and Escape closes it again and returns you to the workspace. ' +
          'Press T, then press Escape.',
        sequence: [
          {
            detect: { code: 'KeyT' },
            prompt: 'Press T to open the toolbox.',
            done: 'Good. T opens the toolbox.',
            confirm: 'toolboxOpen',
            cue: 'Toolbox open.'
          },
          {
            detect: { key: 'Escape' },
            prompt: 'Now press Escape to close it and return to the workspace.',
            done: 'Good. Escape closes it.',
            confirm: 'toolboxClosed',
            cue: 'Toolbox closed — back on the workspace.'
          }
        ],
        helpRow: 7,
        mode: 'any',
        scene: 'empty',
        live: { focus: 'workspace', requiresKeyboardNav: true },
        success: 'That is the pair: T opens the toolbox, Escape closes it and brings you back to the workspace.'
      },
      {
        id: 'place-first-block',
        label: 'Place a block from the toolbox',
        keywords: ['place block', 'add block', 'insert block', 'first block',
          'drop block', 'build', 'create block', 'print block', 'pick block', 'choose block'],
        keyHint: 'T, then arrows and Enter',
        instruction:
          'Now build something. Press T to open the toolbox, use the Up and Down ' +
          'arrows to move through the categories and blocks, and press Enter on a ' +
          'block — a print block is a good first one — to drop it on the canvas. We ' +
          'confirm the moment a new block actually appears.',
        // No single detect: placing a block is a short interaction (open, choose,
        // Enter). We confirm the real result — a block appeared — with the
        // workspaceChanged probe, and listen for Enter as the triggering key.
        detect: { key: 'Enter' },
        mode: 'any',
        scene: 'empty',
        live: { focus: 'workspace', requiresKeyboardNav: true, confirm: 'workspaceChanged' },
        success:
          'A block is on the canvas — you placed it entirely from the keyboard. ' +
          'Next we will load a larger program to explore.'
      },
      // --- SCENE: two-stack program --------------------------------------------
      {
        id: 'move-down',
        label: 'Move to the next block',
        keywords: ['next', 'down', 'after', 'forward', 'following', 'subsequent',
          'move down', 'go down', 'navigate down', 'later block'],
        keyHint: 'S',
        instruction:
          'A two-stack program is on the canvas now and your cursor is on the ' +
          'if-else block at the top of Stack A. Press S to move the cursor down to ' +
          'the next block — the print that comes after the if-else.',
        detect: { code: 'KeyS' },
        helpRow: 1,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'aIf', confirm: 'cursorMoved' },
        success: 'Moved down to the next block.'
      },
      {
        id: 'move-up',
        label: 'Move to the previous block',
        keywords: ['previous', 'up', 'before', 'back', 'prior', 'preceding',
          'move up', 'go up', 'navigate up', 'earlier block'],
        keyHint: 'W',
        instruction:
          'Press W to move the cursor up to the previous block. Your cursor is on ' +
          'the print after the if-else — press W to step back up to the if-else.',
        detect: { code: 'KeyW' },
        helpRow: 0,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'aAfter', confirm: 'cursorMoved' },
        success: 'Moved up to the previous block.'
      },
      {
        id: 'move-in-child',
        label: 'Move in to a child',
        keywords: ['in', 'child', 'inside', 'into', 'first inside', 'move in',
          'go in', 'enter', 'inner', 'down a level'],
        keyHint: 'D',
        instruction:
          'Press D to move in to the first block inside the current one. Your ' +
          'cursor is on the if-else block — press D to step in toward what it holds.',
        detect: { code: 'KeyD' },
        helpRow: 3,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'aIf', confirm: 'cursorMoved' },
        success: 'Moved in to the child.'
      },
      {
        id: 'move-out-parent',
        label: 'Move out to the parent',
        keywords: ['out', 'parent', 'container', 'outer', 'move out', 'level up',
          'exit', 'leave block', 'enclosing', 'go out'],
        keyHint: 'A',
        instruction:
          'Press A to move out to the block that contains the current one. Your ' +
          'cursor is on the if-else block\'s true-or-false test — press A to move ' +
          'out to the if-else that holds it.',
        detect: { code: 'KeyA' },
        helpRow: 2,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'aCond', confirm: 'cursorMoved' },
        success: 'Moved out to the parent.'
      },
      {
        id: 'move-into-nested',
        label: 'Step into a nested block',
        keywords: ['nest', 'nesting', 'nesting in', 'nested', 'go inside', 'inside',
          'into', 'child', 'deeper', 'step in', 'drill in', 'inside loop', '3d navigation'],
        keyHint: 'F',
        instruction:
          'Press F to step into the first block nested inside a container. Your ' +
          'cursor is on the if-else block — press F to drop inside it, onto the ' +
          'print in its first branch.',
        detect: { code: 'KeyF' },
        helpRow: 4,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'aIf', confirm: 'cursorMoved' },
        success: 'Stepped into the nested block.'
      },
      {
        id: 'move-out-nested',
        label: 'Step back out to the parent',
        keywords: ['nest', 'nesting', 'nesting out', 'go out', 'back out', 'parent',
          'shallower', 'step out', 'climb out', 'exit nest', 'out of loop', '3d navigation'],
        keyHint: 'Q',
        instruction:
          'Press Q to step back out to the parent block or the outer layer. Your ' +
          'cursor is on the print inside the if-else\'s first branch — press Q to ' +
          'climb back out to the if-else that holds it.',
        detect: { code: 'KeyQ' },
        helpRow: 5,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'aIfPrint', confirm: 'cursorMoved' },
        success: 'Stepped out to the parent.'
      },
      {
        id: 'announce-cursor',
        label: 'Ask where the cursor is',
        keywords: ['where am i', 'where', 'cursor', 'cursor location', 'location',
          'position', 'lost', 'orient', 'current', 'read cursor', 'my place', 'locate'],
        keyHint: 'C',
        instruction:
          'Press C at any time to hear where your cursor is right now. It is your ' +
          '"where am I" key — use it whenever you lose your place. Your cursor is on ' +
          'the if-else block; press C to hear it described.',
        detect: { code: 'KeyC' },
        helpRow: 9,
        mode: 'any',
        scene: 'twoStack',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          start: 'aIf',
          cue: 'Cursor location announced by the editor.'
        },
        success: 'The editor announced where your cursor is.'
      },
      {
        id: 'search-stacks',
        label: 'Jump across stacks',
        keywords: ['search stacks', 'jump', 'stack search', 'find stack', 'go to stack',
          'panel', 'list of stacks', 'across stacks', 'switch stack', 'second stack'],
        keyHint: 'Option plus Shift plus G',
        instruction:
          'With two separate stacks on the canvas, you need a way to leap between ' +
          'them. Hold Option, Shift, and G to open a panel that lists every stack ' +
          'and its blocks. Move to Stack B\'s second block and press Enter to land ' +
          'your cursor there. Your cursor is on Stack A — press Option plus Shift ' +
          'plus G to open the panel.',
        detect: { code: 'KeyG', alt: true, shift: true },
        helpRow: 25,
        mode: 'any',
        scene: 'twoStack',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          needsBlocks: true,
          start: 'aIf',
          cue: 'Stack search panel opened — choose a stack and block to jump to.'
        },
        success:
          'That is Option plus Shift plus G — the stack search. It lists every ' +
          'stack so you can jump straight to any block, however far apart they are.'
      },
      {
        id: 'shortcuts-list',
        label: 'Open the shortcuts list',
        keywords: ['shortcuts list', 'shortcut help', 'all shortcuts', 'key list',
          'cheat sheet', 'reference', 'list keys', 'help list', 'what are the keys'],
        keyHint: 'Shift plus K',
        instruction:
          'Press Shift plus K to open or close the full shortcuts list — every key ' +
          'the editor knows, read out in order. It is your reference whenever you ' +
          'forget a key. Press Shift plus K now.',
        detect: { code: 'KeyK', shift: true },
        helpRow: 27,
        mode: 'any',
        scene: 'twoStack',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          cue: 'Shortcuts list opened — press Shift plus K again to close it.'
        },
        success: 'That is Shift plus K — open or close the shortcuts list any time.'
      },
      {
        id: 'navigational-assistant',
        label: 'Open the navigational assistant',
        keywords: ['navigation assistant', 'assistant', 'help', 'where can i go',
          'options', 'available moves', 'directions', 'guide', 'what can i do', 'choices'],
        keyHint: 'Shift plus H',
        instruction:
          'Press Shift plus H to open the navigational assistant. It reads out ' +
          'where you are and where you can move from the block at your cursor, so ' +
          'it only makes sense with a block under the cursor. Your cursor is on the ' +
          'if-else block; press Shift plus H.',
        detect: { code: 'KeyH', shift: true },
        helpRow: 29,
        mode: 'any',
        scene: 'twoStack',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          needsBlocks: true,
          start: 'aIf',
          cue: 'Navigational assistant opened — it describes where you can move from here.'
        },
        success: 'Navigational assistant opened.'
      },
      {
        id: 'run-program',
        label: 'Run your program',
        keywords: ['run', 'execute', 'play', 'start', 'go', 'run program',
          'run code', 'test it', 'launch'],
        keyHint: 'Shift plus R',
        instruction:
          'Press Shift plus R to run your program. There are two stacks on the ' +
          'workspace now, so the run has something to do.',
        detect: { code: 'KeyR', shift: true },
        helpRow: 30,
        mode: 'any',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, cue: 'Program run.' },
        success: 'Program run.'
      },
      {
        id: 'open-output',
        label: 'Open the output panel',
        keywords: ['output', 'result', 'what printed', 'console', 'read output',
          'hear output', 'results panel', 'what it said', 'see output'],
        keyHint: 'Shift plus O',
        instruction:
          'Press Shift plus O to open the output panel and hear what your program ' +
          'produced. Run the program first with Shift plus R so there is output to ' +
          'read. Inside the panel, W and S move you line by line through the output.',
        detect: { code: 'KeyO', shift: true },
        helpRow: 31,
        mode: 'any',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, cue: 'Output panel opened.' },
        success:
          'Output panel opened. Inside it, press W and S to read the output one ' +
          'line at a time.'
      }
    ]
  },

  // ===========================================================================
  // TRACK 2 — EDITING: change the program. Live steps are confirmed by watching
  // the real workspace change; E and the label editor are rehearsed honestly.
  // ===========================================================================
  {
    id: 'track-editing',
    title: 'Editing',
    description:
      'Now change the two-stack program. First the master idea — switching between ' +
      'Navigation mode and Edit mode with E. Then move a block up or down, ' +
      'disconnect it, cut, copy, paste, and delete it, comment it, reach into a ' +
      'block\'s inner property, and finally label a whole stack and fast-travel to ' +
      'it. Each block-changing step is confirmed by watching the real workspace ' +
      'change, so you know the edit actually happened.',
    requiresSandbox: true,
    shortcuts: [
      {
        id: 'toggle-edit-mode',
        label: 'Switch between Navigation and Edit mode',
        keywords: ['edit mode', 'mode', 'switch mode', 'toggle mode', 'change mode',
          'navigation mode', 'edit', 'enter edit', 'mode switch', 'read or edit'],
        keyHint: 'E',
        instruction:
          'There are two modes. In Navigation mode you read and move the cursor. In ' +
          'Edit mode you connect and disconnect blocks. Press E to switch between ' +
          'them, and Escape to leave Edit mode. Knowing which mode you are in is the ' +
          'key to everything else here. Press E now to toggle the mode.',
        detect: { code: 'KeyE' },
        helpRow: 6,
        mode: 'any',
        scene: 'twoStack',
        success:
          'Edit mode toggled. Press E again or Escape to return to Navigation mode. ' +
          'When an editing key seems to do nothing, check your mode first.'
      },
      {
        id: 'move-block-up',
        label: 'Move a block up',
        keywords: ['move block up', 'reorder', 'rearrange', 'lift', 'swap up',
          'block up', 'shift up', 'reorder up', 'promote', 'move statement up'],
        keyHint: 'Shift plus W',
        instruction:
          'With the cursor on a block, hold Shift and press W to move that whole ' +
          'block up in its stack. This is the same Shift+W that moved the marker ' +
          'over empty space — but with a block selected it moves the block. Your ' +
          'cursor is on the print after the if-else; press Shift plus W to lift it ' +
          'above the if-else.',
        detect: { code: 'KeyW', shift: true },
        helpRow: 14,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'aAfter', confirm: 'workspaceChanged' },
        success: 'Block moved up — it now sits above the if-else.'
      },
      {
        id: 'move-block-down',
        label: 'Move a block down',
        keywords: ['move block down', 'reorder', 'rearrange', 'drop', 'swap down',
          'block down', 'shift down', 'reorder down', 'demote', 'move statement down'],
        keyHint: 'Shift plus S',
        instruction:
          'Hold Shift and press S to move the block at your cursor down in its ' +
          'stack. Your cursor is on the if-else block; press Shift plus S to drop it ' +
          'below the print that follows it.',
        detect: { code: 'KeyS', shift: true },
        helpRow: 15,
        mode: 'navigation',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'aIf', confirm: 'workspaceChanged' },
        success: 'Block moved down — the if-else now sits below the print.'
      },
      {
        id: 'disconnect-block',
        label: 'Disconnect a block',
        keywords: ['disconnect', 'detach', 'unplug', 'separate', 'pull apart',
          'loose', 'unhook', 'break apart', 'split', 'take off'],
        keyHint: 'E, then Shift plus X',
        instruction:
          'Disconnecting happens in Edit mode, with your cursor sitting on the joint ' +
          'between two blocks. Your cursor is on the print after the if-else. First ' +
          'press E to enter Edit mode — the cursor drops onto the connection just ' +
          'above the block. Then press Shift plus X to detach the block, leaving it ' +
          'loose on the canvas.',
        detect: { code: 'KeyX', shift: true },
        helpRow: 13,
        mode: 'edit',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'aAfter', confirm: 'workspaceChanged' },
        success: 'Block disconnected — it is now loose on the workspace.'
      },
      {
        id: 'cut-paste-block',
        label: 'Cut a block and paste it back',
        keywords: ['cut', 'paste', 'cut paste', 'clipboard', 'relocate', 'move block',
          'cut and paste', 'copy move', 'lift and drop'],
        keyHint: 'Control or Command plus X, then plus V',
        instruction:
          'Cut and paste move a block from one place to another. Hold Control or ' +
          'Command and press X to cut the block at your cursor, then hold Control or ' +
          'Command and press V to paste it back in. Your cursor is on the print ' +
          'after the if-else — cut it, then paste it.',
        sequence: [
          {
            detect: { code: 'KeyX', mod: true },
            prompt: 'Hold Control or Command and press X to cut the block.',
            done: 'Cut. The block is on the clipboard.',
            confirm: 'workspaceChanged',
            cue: 'Block cut — it left the workspace.',
            start: 'aAfter'
          },
          {
            detect: { code: 'KeyV', mod: true },
            prompt: 'Now hold Control or Command and press V to paste it back.',
            done: 'Pasted.',
            confirm: 'workspaceChanged',
            cue: 'Block pasted back onto the workspace.'
          }
        ],
        helpRow: 16,
        mode: 'any',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true },
        success: 'That is cut and paste: Control or Command plus X to lift a block, plus V to drop it back in.'
      },
      {
        id: 'copy-block',
        label: 'Copy a block',
        keywords: ['copy', 'duplicate', 'clone', 'copy block', 'clipboard',
          'replicate', 'copy paste', 'make a copy'],
        keyHint: 'Control or Command plus C',
        instruction:
          'Copy leaves the original in place and puts a copy on the clipboard, ' +
          'ready to paste. Hold Control or Command and press C to copy the block at ' +
          'your cursor. Your cursor is on the print after the if-else; copy it, then ' +
          'paste it with Control or Command plus V.',
        detect: { code: 'KeyC', mod: true },
        mode: 'any',
        scene: 'twoStack',
        // Copy does not change the workspace, so there is nothing to confirm from
        // state — this is an honest keystroke drill with a spoken cue.
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          needsBlocks: true,
          start: 'aAfter',
          cue: 'Block copied to the clipboard — paste it with Control or Command plus V.'
        },
        success:
          'That is copy: Control or Command plus C duplicates the block onto the ' +
          'clipboard, leaving the original where it is. Paste it with plus V.'
      },
      {
        id: 'delete-block',
        label: 'Delete a block',
        keywords: ['delete', 'remove', 'erase', 'trash', 'get rid', 'clear',
          'destroy', 'take away', 'discard', 'bin'],
        keyHint: 'Delete',
        instruction:
          'Press the Delete key to remove the block at your cursor for good. Your ' +
          'cursor is on the print after the if-else; press Delete to remove it.',
        detect: { key: 'Delete' },
        helpRow: 18,
        mode: 'any',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'aAfter', confirm: 'workspaceChanged' },
        success: 'Block deleted — it is gone from the workspace.'
      },
      {
        id: 'comment-block',
        label: 'Add or hide a comment',
        keywords: ['comment', 'note', 'annotate', 'add comment', 'hide comment',
          'remark', 'memo', 'description', 'explain block'],
        keyHint: 'Control or Command plus Slash',
        instruction:
          'Hold Control or Command and press the slash key to add a comment to the ' +
          'block at your cursor, or hide it again. Your cursor is on the if-else ' +
          'block; press Control or Command plus slash to toggle a comment on it.',
        detect: { code: 'Slash', mod: true },
        helpRow: 19,
        mode: 'any',
        scene: 'twoStack',
        // Toggling a comment adds an (initially empty) comment bubble, which does
        // NOT change the serialized workspace — so there is nothing reliable to
        // confirm from state. Like copy, this is an honest keystroke drill: the
        // detect pins the exact key, the real plugin toggles the comment, and a
        // spoken cue confirms it.
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          needsBlocks: true,
          start: 'aIf',
          cue: 'Comment toggled on the block at your cursor.'
        },
        success: 'Comment toggled on the block.'
      },
      {
        id: 'focus-property',
        label: 'Reach into a block\'s inner value',
        keywords: ['property', 'inner value', 'inside value', 'field', 'condition',
          'focus property', 'reach in', 'inner element', 'the value', 'edit value',
          'into the slot', 'test value'],
        keyHint: 'Shift plus F',
        instruction:
          'Blocks hold parts inside them — a while loop holds its while-or-until ' +
          'selector and its test, a set block holds its count. Press Shift plus F ' +
          'to jump the cursor straight to the block\'s first inner part so you can ' +
          'read or change it. Your cursor is on the while loop in Stack B; press ' +
          'Shift plus F to drop onto its while-or-until selector.',
        detect: { code: 'KeyF', shift: true },
        helpRow: 24,
        mode: 'any',
        scene: 'twoStack',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'bWhile', confirm: 'cursorMoved' },
        success: 'Reached the block\'s inner value — the cursor is on it now.'
      },
      {
        id: 'label-stack',
        label: 'Label a whole stack',
        keywords: ['label', 'stack labels', 'name', 'name stack', 'label stack',
          'title', 'tag', 'mark', 'stack name', 'jump label', 'bookmark', 'customize'],
        keyHint: 'Shift plus I',
        instruction:
          'You can name a whole stack so you can jump to it later. With the cursor ' +
          'on the top block of a stack, press Shift plus I to open the label editor ' +
          'and type a name. Your cursor is on the if-else at the top of Stack A; ' +
          'press Shift plus I to name this stack.',
        detect: { code: 'KeyI', shift: true },
        helpRow: 28,
        mode: 'any',
        scene: 'twoStack',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          needsBlocks: true,
          start: 'aIf',
          cue: 'Label editor opened — type a name for the stack.'
        },
        success:
          'That is Shift plus I — it opens the label editor for the stack at your ' +
          'cursor. Give a stack a one-letter name and you can jump to it instantly.'
      },
      {
        id: 'jump-to-label',
        label: 'Fast-travel to a labelled stack',
        keywords: ['jump to label', 'jump to stack', 'fast travel', 'go to label',
          'teleport', 'option letter', 'alt letter', 'labelled stack', 'quick jump',
          'jump letter'],
        keyHint: 'Option plus a letter',
        instruction:
          'Once a stack has a label, hold Option and press the first letter of that ' +
          'label to jump your cursor straight to it from anywhere — no matter how ' +
          'far away it is. For practice, hold Option and press A, as if jumping to ' +
          'a stack you labelled with the letter A.',
        detect: { code: 'KeyA', alt: true },
        helpRow: 26,
        mode: 'any',
        scene: 'twoStack',
        // Rehearsal: there is no guaranteed stack labelled "A" on the canvas, so we
        // honestly confirm the keystroke and teach the pattern rather than fake a
        // jump. The real jump works once the learner has labelled a stack.
        success:
          'That is the fast-travel key: Option plus a letter jumps to the stack ' +
          'labelled with it. Pair it with Shift plus I and you can name stacks and ' +
          'leap between them across a big program.'
      }
    ]
  }
];

/**
 * Flattened list of every shortcut with its track id attached. Convenient for
 * progress tracking and lookups.
 * @returns {Array<object>}
 */
export function getAllShortcuts() {
  return KEYBOARD_TRACKS.flatMap((track) =>
    track.shortcuts.map((s) => ({ ...s, trackId: track.id }))
  );
}

/**
 * Search the moves by concept, name, or key.
 *
 * This is the engine behind the trainer's "jump to what you want to learn" front
 * door. A BVI learner who does not know that nesting-in is F can type "nest" and
 * get BOTH F (in) and Q (out) — because both moves carry "nest" in `keywords`.
 *
 * Matching, deliberately forgiving (a learner should not have to guess our exact
 * wording — DTorial: "Finding is universal") but not sloppy:
 *   - Each move is reduced to a WORD SET (every word in its label, key hint, and
 *     keyword synonyms) plus its KEY TOKENS (the letters/named keys in the hint,
 *     e.g. "Shift plus W, A, S, D" gives w, a, s, d).
 *   - A query of 1-2 characters must match a whole word OR a key token. That is
 *     what makes "F" mean the move bound to F and "W" the three W moves, instead
 *     of substring-matching the "f" inside "forward" or "flyout".
 *   - A query of 3+ characters matches on WORD PREFIX, so "nes" finds "nesting"
 *     but "cut" no longer hides inside "exe-cut-e".
 *   - Multi-word AND: every whitespace token must match, so "move down" narrows.
 *   - One query reaches a move by concept ("delete"), by name ("step into"), or
 *     by key ("f") — all three live in the same word set.
 *
 * Ranking puts the most literal hit first: exact key, then exact keyword/label,
 * then prefix hits, then the rest. Ties keep track order (Navigation before
 * Editing), matching the linear curriculum.
 *
 * @param {string} query - Raw text typed by the learner.
 * @returns {Array<object>} Matching shortcuts (with trackId), best first.
 */
export function searchShortcuts(query) {
  // Key hints are authored with the WORDS "plus" and "slash" (e.g. "Shift plus
  // W") because a screen reader reads those aloud naturally. But learners type
  // the SYMBOLS — "shift+w", "ctrl+/". The tokenizer below strips every
  // non-alphanumeric character, so a bare "+" or "/" would otherwise match
  // nothing. Fold those symbols (and the common ctrl/cmd abbreviations) to the
  // words the hints actually use, BEFORE tokenizing, so symbol and word queries
  // behave identically.
  const normalizeQuery = (s) =>
    s
      .replace(/\+/g, ' plus ')
      .replace(/\//g, ' slash ')
      .replace(/\bctrl\b/g, 'control')
      .replace(/\bcmd\b/g, 'command');

  const q = normalizeQuery((query || '').trim().toLowerCase());
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const splitWords = (s) => s.split(/[^a-z0-9]+/).filter(Boolean);

  return getAllShortcuts()
    .map((sc, order) => {
      const label = (sc.label || '').toLowerCase();
      const keyHint = (sc.keyHint || '').toLowerCase();
      const keywords = (sc.keywords || []).map((k) => k.toLowerCase());
      const words = splitWords([label, ...keywords, keyHint].join(' '));
      const wordSet = new Set(words);
      const keyTokens = splitWords(keyHint); // includes modifier words; harmless

      // Short queries (a key letter, "in", "up") must hit a whole word or a key
      // token, so "F" means the F move, not the "f" inside "forward"/"flyout".
      // Longer queries match on word prefix (autocomplete), so "cut" no longer
      // hides inside "exe-cut-e".
      const matchTok = (t) =>
        t.length <= 2
          ? wordSet.has(t) || keyTokens.includes(t)
          : words.some((w) => w.startsWith(t)) || keyTokens.includes(t);

      if (!tokens.every(matchTok)) return null;

      let score = 0;
      if (keyTokens.includes(q)) score += 100; // typed the key, e.g. "f"
      if (keywords.includes(q)) score += 60; // typed a synonym exactly, e.g. "nest"
      if (label === q) score += 60;
      if (label.startsWith(q)) score += 30;
      if (keywords.some((k) => k.startsWith(q))) score += 20;
      score += tokens.reduce((s, t) => s + (matchTok(t) ? 1 : 0), 0);

      return { sc, score, order };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.sc);
}

/**
 * Match a KeyboardEvent against a detection signature. Strict: any modifier not
 * named in the signature must be absent, so "S" never matches "Shift+S".
 * @param {KeyboardEvent} event
 * @param {object} detect - Detection signature.
 * @returns {boolean}
 */
export function matchesShortcut(event, detect) {
  if (detect.code && event.code !== detect.code) return false;
  if (detect.key && event.key !== detect.key) return false;

  const wantShift = !!detect.shift;
  const wantAlt = !!detect.alt;

  if (event.shiftKey !== wantShift) return false;
  if (event.altKey !== wantAlt) return false;

  // `ctrl` pins to the Control key specifically — some plugin shortcuts (e.g. the
  // keyboard-nav toggle) bind Ctrl only, even on Mac, so Cmd must NOT match.
  // `mod` is the looser "Ctrl OR Cmd" used by shortcuts that register both.
  if (detect.ctrl) {
    if (!event.ctrlKey || event.metaKey) return false;
  } else {
    const wantMod = !!detect.mod;
    const hasMod = event.ctrlKey || event.metaKey;
    if (hasMod !== wantMod) return false;
  }

  return true;
}
