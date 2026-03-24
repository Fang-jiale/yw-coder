export const BREAKPOINTS = {
  MOBILE: 640,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE_DESKTOP: 1280,
} as const;

export const SCROLL_THRESHOLD = 100;

export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  RESIZE: 150,
  SCROLL: 100,
  INPUT: 200,
} as const;

export const THROTTLE_DELAY = {
  SCROLL: 100,
  RESIZE: 150,
  MOUSE_MOVE: 50,
} as const;

export const MAX_RETRIES = 3;

export const RETRY_DELAY = {
  BASE: 1000,
  MULTIPLIER: 2,
} as const;

export const MESSAGE_MAX_LENGTH = 10000;

export const INPUT_HEIGHT = {
  MIN: 80,
  MAX: 300,
  DEFAULT: 80,
} as const;

export const CODE_BLOCK = {
  MAX_HEIGHT: 500,
  MIN_LINES: 5,
  FONT_SIZE: '0.75rem',
  LINE_HEIGHT: 1.5,
} as const;

export const PANEL = {
  SIDEBAR: {
    DEFAULT_WIDTH: 250,
    MIN_WIDTH: 150,
    MAX_WIDTH: 400,
  },
  CHAT: {
    DEFAULT_WIDTH: 400,
    MIN_WIDTH: 300,
    MAX_WIDTH: 600,
  },
  TERMINAL: {
    DEFAULT_HEIGHT: 200,
    MIN_HEIGHT: 100,
    MAX_HEIGHT: 600,
  },
} as const;

export const TOAST = {
  DURATION: {
    SHORT: 3000,
    NORMAL: 5000,
    LONG: 8000,
  },
  LIMIT: 1,
  REMOVE_DELAY: 1000000,
} as const;

export const KEYBOARD_SHORTCUTS = {
  SEND_MESSAGE: { key: 'Enter', modifiers: [] },
  NEW_LINE: { key: 'Enter', modifiers: ['shift'] },
  CLEAR_INPUT: { key: 'Escape', modifiers: [] },
  OPEN_SETTINGS: { key: ',', modifiers: ['ctrl'] },
  SEARCH: { key: 'f', modifiers: ['ctrl'] },
  SAVE: { key: 's', modifiers: ['ctrl'] },
} as const;

export const STATUS = {
  TODO: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const TOOL_CALL_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;
