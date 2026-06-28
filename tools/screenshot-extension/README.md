# Nhost Screenshot Tool (Chrome extension)

Internal, dev-only Chrome extension for composing screenshots of the docs site,
the dashboard, or any page — in any environment (prod / staging / dev). It shows
a control toolbar **above** the page (it pushes the page down rather than
overlaying it) where you can **dim** the background, **spotlight** (cut out)
chosen elements, and draw an accent **outline + glow**, then capture the visible
viewport and **save**, **download**, or **copy** it.

It runs as a Chrome extension because that is the only way to read and
manipulate a page's real DOM/CSS while bypassing the dashboard's strict CSP
(content scripts run in a privileged context). Nothing ships in any app
bundle — the tool only exists for developers who load this extension.

## Features

- **Toggle hotkey** — **Ctrl/Cmd+Shift+S** (or click the toolbar icon) shows/hides the tool on the current tab. This is a browser-global shortcut; rebind or disable it at `chrome://extensions/shortcuts`.
- **Dim** — fade the page background to make a subject stand out.
- **Spotlight** — click elements to cut them out of the dim so they stay bright.
- **Outline + glow** — draw an accent border with a soft glow, with color swatches.
- **Capture** — grab the visible viewport (the toolbar hides itself first) into a save modal.
- **Save / Download / Copy** — native save dialog, one-click timestamped download, or PNG to the clipboard.
- **Works anywhere** — runs on any `http`/`https` page, in any environment (prod / staging / dev).

## Build & install (load unpacked)

```bash
cd tools/screenshot-extension
pnpm install --ignore-workspace   # standalone; not part of the pnpm workspace
pnpm build                         # bundles src/ -> dist/
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select `tools/screenshot-extension/dist`.

After pulling changes, re-run `pnpm build` and hit the reload icon on the
extension card. Use `pnpm watch` to rebuild on save (then reload the card).

## Prototype the UI fast (no extension reload)

Most of the tool is plain DOM/CSS in a ShadowRoot — only capture and download
touch Chrome APIs. To iterate on the toolbar/modal look without
rebuilding and reloading the unpacked extension:

```bash
pnpm dev      # serves dev/harness.html with esbuild live-reload
```

Open `http://localhost:5500/harness.html`. It mounts the **real** toolbar with
the Chrome calls stubbed (capture returns a placeholder image; download/save-as
trigger a normal browser download). Editing `src/content/*.ts` reloads the page
instantly.

This can't exercise the real `captureVisibleTab` or the native save dialog, so
still load the unpacked extension to verify the actual capture/save flow.

## Icon

The icon is a single source SVG (`icons/icon.svg`) baked into the PNG sizes the
manifest needs. Requires Google Chrome / Chromium (renderer) and ImageMagick
(downscale); set `CHROME=/path/to/chrome` if it isn't auto-found.

```bash
pnpm icons         # bake icon-{16,32,48,128}.png + a preview.png contact sheet
pnpm icons:watch   # rebake on every icon.svg save + live-reload a preview page
```

`pnpm icons:watch` serves `http://localhost:5510/` showing the **real** baked
PNGs at true size on light/dark and in a mock browser toolbar; editing
`icons/icon.svg` rebakes and repaints automatically. The PNGs are committed and
copied into `dist/` by `pnpm build` — re-run `pnpm icons` (then `pnpm build`)
after changing the SVG. `icons/preview.png` is generated and git-ignored.

## Usage

- Press **Ctrl/Cmd+Shift+S** (or click the extension's toolbar icon) to toggle
  the tool on the current tab. The toolbar's controls are centered, with a
  clear **✕** pinned to the right to exit.
- **Select** → click elements to spotlight them (Esc stops picking).
- **Dim / Outline / Glow** + color swatches tune the look.
- **Capture** → grabs the visible viewport (our toolbar is hidden and the
  page push-down is dropped first, so the real page is captured) and opens the
  save modal. The controls row holds the filename field, **Save as**, and
  icon-only **download** and **copy** buttons; the preview has a full-screen
  expand toggle.

The capture is `chrome.tabs.captureVisibleTab` — pixel-perfect, viewport only.
(Full-page stitching is not implemented yet.)

### Save targets

- **Save as** opens the browser's native save dialog, so you choose any
  location and confirm the filename (defaults to `screenshot-<timestamp>.png`).
- **Download** writes that same flat, timestamped file straight to the
  browser's download directory — no dialog.
- **Copy** puts the PNG on the clipboard.

## Layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest (copied into `dist/` at build) |
| `icons/` | Extension icon (`icon.svg` source + 16/32/48/128 PNGs, copied into `dist/` at build) |
| `src/background.ts` | Service worker: toggle/inject, captureVisibleTab, downloads |
| `src/content/index.ts` | Injected entry; wires the toggle message to the toolbar |
| `src/content/ui.ts` | Toolbar + save-modal DOM (ShadowRoot) |
| `src/content/overlay.ts` | Dim / spotlight / outline effect engine |
| `src/content/styles.ts` | ShadowRoot-scoped CSS |
| `src/content/capture.ts` | Capture/clipboard/download message helpers |
| `src/content/messages.ts` | Message protocol shared by content + background |
| `dev/serve.mjs` | Live-reload dev server (esbuild watch + serve) for the harness |
| `dev/harness.{ts,html}` | Dev page that mounts the toolbar with Chrome APIs stubbed |
| `dev/make-icons.mjs` | Icon pipeline: render SVG → PNG sizes (+ `--watch` live preview) |
| `dev/icons.html` | Icon preview page (true PNGs, light/dark, mock toolbar) |
| `icons/icon.svg` | Icon source; PNGs are baked from it by `pnpm icons` |
