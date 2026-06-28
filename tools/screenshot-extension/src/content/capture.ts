// Capture + output helpers for the content script.
//
// captureVisibleTab, chrome.downloads and the cross-origin save fetch all live
// in the background worker, so this module just forwards those requests. The
// clipboard write stays here because it needs the page's DOM + user gesture.

import type {
  ActionResponse,
  CaptureResponse,
  ContentRequest,
} from './messages.ts';

/** Resolve after the browser has laid out and painted one frame, so a just-
 * hidden element is gone from the pixels before captureVisibleTab reads them. */
export function nextRepaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function requestCapture(): Promise<string> {
  const res = (await chrome.runtime.sendMessage({
    type: 'capture',
  } satisfies ContentRequest)) as CaptureResponse;
  if (!res.ok) {
    throw new Error(res.error);
  }
  return res.dataUrl;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2);
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/** Ask the worker to open chrome://extensions/shortcuts (page content can't
 * navigate to chrome:// URLs itself). */
export function requestOpenShortcuts(): void {
  void chrome.runtime.sendMessage({
    type: 'open-shortcuts',
  } satisfies ContentRequest);
}

export async function requestDownload(
  dataUrl: string,
  filename: string,
  saveAs = false,
): Promise<void> {
  const res = (await chrome.runtime.sendMessage({
    type: 'download',
    dataUrl,
    filename,
    saveAs,
  } satisfies ContentRequest)) as ActionResponse;
  if (!res.ok) {
    throw new Error(res.error);
  }
}
