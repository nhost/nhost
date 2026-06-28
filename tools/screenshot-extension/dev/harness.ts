// Dev harness: mount the screenshot toolbar in a normal page with the
// Chrome-only operations (capture / download) stubbed, so the UI can be
// iterated on with esbuild's live-reload instead of rebuilding and reloading
// the unpacked extension. Not shipped — lives outside src/.

import type { ContentRequest } from '../src/content/messages.ts';
import { createToolbar } from '../src/content/ui.ts';

/** A believable stand-in for captureVisibleTab: paint the current viewport size
 * onto a canvas so the save modal shows a real-looking preview. */
function placeholderCapture(): string {
  const w = Math.max(window.innerWidth, 320);
  const h = Math.max(window.innerHeight, 240);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a2230');
    grad.addColorStop(1, '#0b0d12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9aa3b2';
    ctx.textAlign = 'center';
    ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Stub capture', w / 2, h / 2 - 10);
    ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(
      `${w}×${h} · ${new Date().toLocaleTimeString()}`,
      w / 2,
      h / 2 + 20,
    );
  }
  return canvas.toDataURL('image/png');
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// Stub chrome.runtime so capture.ts's sendMessage calls resolve locally. The
// content code is still typed against @types/chrome; this only supplies runtime
// behaviour for the harness.
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    sendMessage: async (message: ContentRequest) => {
      switch (message.type) {
        case 'capture':
          return { ok: true, dataUrl: placeholderCapture() };
        case 'download':
          triggerDownload(message.dataUrl, message.filename);
          console.info(
            `[harness] ${message.saveAs ? 'save as' : 'download'} →`,
            message.filename,
          );
          return { ok: true };
        case 'open-shortcuts':
          console.info('[harness] open chrome://extensions/shortcuts');
          return undefined;
      }
    },
  },
};

const toolbar = createToolbar();
toolbar.activate();

document
  .getElementById('harness-toggle')
  ?.addEventListener('click', () => toolbar.toggle());
