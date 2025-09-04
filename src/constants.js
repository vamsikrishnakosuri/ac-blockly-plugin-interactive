/**
 * Keyboard navigation states.
 * The different parts of Blockly that the user navigates between.
 * @enum {string}
 * @const
 * @public
 */
export const STATE = {
  WORKSPACE: 'workspace',
  FLYOUT: 'flyout',
  TOOLBOX: 'toolbox',
};

/**
 * Default keyboard navigation shortcut names.
 * @enum {string}
 * @const
 * @public
 */
export const SHORTCUT_NAMES = {
  PREVIOUS: 'previous',
  NEXT: 'next',
  IN: 'in',
  LAYER_IN: 'layer_in',
  LAYER_OUT: 'layer_out',
  OUT: 'out',
  INSERT: 'insert',
  MARK: 'mark',
  DISCONNECT: 'disconnect',
  TOOLBOX: 'toolbox',
  EXIT: 'exit',
  TOGGLE_KEYBOARD_NAV: 'toggle_keyboard_nav',
  COPY: 'keyboard_nav_copy',
  CUT: 'keyboard_nav_cut',
  PASTE: 'keyboard_nav_paste',
  DELETE: 'keyboard_nav_delete',
  UNDO: 'keyboard_nav_undo',
  MOVE_WS_CURSOR_UP: 'workspace_up',
  MOVE_WS_CURSOR_DOWN: 'workspace_down',
  MOVE_WS_CURSOR_LEFT: 'workspace_left',
  MOVE_WS_CURSOR_RIGHT: 'workspace_right',
  EDIT_MODE: 'edit_mode',
  EDIT_STACK_LABEL: 'editStackLabel',
  STACK_SEARCH: 'stackSearch',
  CURSOR_LOC: 'cursor_location',
  ADD_COMMENT: "add_comment",
  MOVE_STATEMENT_UP: "keyboard_move_stmt_up",
  MOVE_STATEMENT_DOWN: "keyboard_move_stmt_down",
  SHOW_SHORTCUTS: 'show_shortcuts',
};

/**
 * Types of possible messages passed into the loggingCallback in the Navigation
 * class.
 * @enum {string}
 * @const
 * @public
 */
export const LOGGING_MSG_TYPE = {
  ERROR: 'error',
  WARN: 'warn',
  LOG: 'log',
};


/**
 * Shortcut map for the Shortcut Assistance modal.
 */
export const SHORTCUT_HELP_ROWS = [
  {
    keys: ['W'], title: 'Navigation Mode: move cursor up to previous block',
    detail: 'Edit mode: move to the top connection.'
  },
  {
    keys: ['S'], title: 'Navigation Mode: move cursor down to next block',
    detail: 'Edit mode: move to the bottom connection.'
  },
  {
    keys: ['A'], title: 'Navigation Mode: move cursor left to previous block',
    detail: 'Edit mode: move to the left connection.'
  },
  {
    keys: ['D'], title: 'Navigation Mode: move cursor right to next block',
    detail: 'Edit mode: move to the right connection.'
  },
  {
    keys: ['F'], title: 'Navigation Mode: move to first nested block of current container block',
    detail: 'Edit Mode: move first nested connection of current block'
  },
  {keys: ['Q'], title: 'Move cursor out to parent block or outer layer'},
  {keys: ['E'], title: 'Toggle Edit mode (enter or exit)'},
  {keys: ['T'], title: 'Open the toolbox'},
  {keys: ['Esc'], title: 'Close toolbox and return focus to workspace'},
  {keys: ['ALT', 'C'], title: 'Announce current cursor location'},
  {keys: ['ALT', 'X'], title: 'Disconnect block from current cursor location (Edit Mode Only)'},
  {keys: ['ALT', 'W'], title: 'Move the selected statement block upward (Navigation Mode Only)'},
  {keys: ['ALT', 'S'], title: 'Move the selected statement block downward (Navigation Mode Only)'},
  {keys: ['MOD', 'X'], title: 'Cut (detach) the selected block (Navigation Mode Only)'},
  {keys: ['MOD', 'V'], title: 'Paste (attach) detached block to a connection (Edit Mode Only)'},
  {keys: ['Del'], title: 'Delete the selected block'},
  {keys: ['MOD', '/'], title: 'Add or hide a comment on the selected block'},
  {keys: ['Shift', 'W'], title: 'Move workspace marker up'},
  {keys: ['Shift', 'S'], title: 'Move workspace marker down'},
  {keys: ['Shift', 'D'], title: 'Move workspace marker right'},
  {keys: ['Shift', 'A'], title: 'Move workspace marker left'},
  {keys: ['ALT', 'Shift', 'G'], title: 'Search stacks'},
  {keys: 'A–Z', title: 'Jump to a stack labelled with that letter'},
  {keys: ['ALT', 'H'], title: 'Open or close this shortcut help'},
  {keys: ['MOD', 'Shift', 'K'], title: 'Enable/disable keyboard accessibility'} // new
];

