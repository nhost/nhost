import type {
  ActionResponse,
  CaptureResponse,
  ContentRequest,
} from './content/messages.ts';

const CONTENT_SCRIPT = 'content.js';

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Toggle the tool on a tab: inject the content script on first use, then let
 * it flip itself on/off for every subsequent press. */
async function toggleTab(tab: chrome.tabs.Tab): Promise<void> {
  const tabId = tab.id;
  if (tabId === undefined) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'toggle' });
  } catch {
    // No content script yet (first press, or after a full page reload).
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT],
    });
    await chrome.tabs.sendMessage(tabId, { type: 'toggle' });
  }
}

chrome.action.onClicked.addListener((tab) => {
  void toggleTab(tab);
});

// Browser-global keyboard shortcut (configurable at chrome://extensions/shortcuts).
// Handled here rather than via a page-level listener so it works on every tab
// without first opening the tool on that page.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-tool') {
    return;
  }
  if (tab) {
    void toggleTab(tab);
    return;
  }
  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([active]) => {
      if (active) {
        void toggleTab(active);
      }
    });
});

async function handleCapture(
  sender: chrome.runtime.MessageSender,
): Promise<CaptureResponse> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(
      sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT,
      { format: 'png' },
    );
    return { ok: true, dataUrl };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

async function handleDownload(
  dataUrl: string,
  filename: string,
  saveAs: boolean,
): Promise<ActionResponse> {
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename.replace(/^\/+/, '') || 'screenshot.png',
      saveAs,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

chrome.runtime.onMessage.addListener(
  (message: ContentRequest, sender, sendResponse) => {
    switch (message.type) {
      case 'capture':
        void handleCapture(sender).then(sendResponse);
        return true;
      case 'download':
        void handleDownload(
          message.dataUrl,
          message.filename,
          message.saveAs ?? false,
        ).then(sendResponse);
        return true;
      case 'open-shortcuts':
        // chrome:// pages can't be opened from page content, so the worker
        // opens the shortcuts page where the toggle command can be rebound.
        void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        return false;
      default:
        return false;
    }
  },
);
