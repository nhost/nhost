import type { ToggleCommand } from './messages.ts';
import { createToolbar } from './ui.ts';

// The background worker injects this file once per tab, then sends `toggle`
// messages on every shortcut/icon press. Guard against a second injection
// (e.g. the worker restarted and lost its injected-tab set) so we keep a single
// toolbar instance and a single message listener per page.
interface ToolWindow extends Window {
  __nhostScreenshotToolReady?: boolean;
}

const win = window as ToolWindow;

if (!win.__nhostScreenshotToolReady) {
  win.__nhostScreenshotToolReady = true;
  const toolbar = createToolbar();

  chrome.runtime.onMessage.addListener((message: ToggleCommand) => {
    if (message?.type === 'toggle') {
      toolbar.toggle();
    }
  });
}
