// Message protocol between the content script and the background service
// worker. captureVisibleTab and chrome.downloads can only run in the worker, so
// the content script delegates those operations and handles the rest (overlay,
// clipboard) itself. "Save as" is just a download with the browser's native
// save dialog (saveAs: true).

export type ContentRequest =
  | { type: 'capture' }
  | { type: 'download'; dataUrl: string; filename: string; saveAs?: boolean }
  | { type: 'open-shortcuts' };

export type CaptureResponse =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

export type ActionResponse =
  | { ok: true; path?: string }
  | { ok: false; error: string };

/** background -> content: flip the tool on/off for this tab. */
export interface ToggleCommand {
  type: 'toggle';
}
