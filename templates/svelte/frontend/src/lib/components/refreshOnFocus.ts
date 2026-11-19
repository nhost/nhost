// How long a signed-in tab is left alone before returning to it loads it again.
export const FOCUS_REFRESH_MS = 5 * 60 * 1000;

// What the root layout's load `depends` on, so that load can run first.
export const SESSION_DEPENDENCY = 'app:session';
