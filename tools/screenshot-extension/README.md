# Nhost Screenshot Tool (Chrome extension)

Chromium extension for composing screenshots of the dashboard, or any page —
in any environment (prod / staging / dev). It shows a control toolbar **above**
the page (it pushes the page down rather than overlaying it) where you can
**dim** the background, **spotlight** (cut out) chosen elements, and draw an
accent **outline**, then capture the visible viewport and **crop**, **save**,
**download**, or **copy** it.

It runs as a Chrome extension because that is the only way to read and
manipulate a page's real DOM/CSS while bypassing the dashboard's strict CSP
(content scripts run in a privileged context). Nothing ships in any app
bundle — the tool only exists for developers who load this extension.

## Features

- **Toggle hotkey** — **Ctrl/Cmd+Shift+S** (or click the extension's toolbar icon) shows/hides the tool on the current tab. It is a browser-global command handled by the service worker, so it works on any tab without opening the tool first. Rebind or disable it at `chrome://extensions/shortcuts`; the **Set hotkey** button in the settings popover opens that page directly.
- **Spotlight** — in **Select** mode, click page elements to cut them out of the dim so they stay bright. Click a spotlit element again to remove it. Each pick remembers the color/padding/thickness/radius it was made with, so later setting changes only affect *new* picks.
- **Auto dim** — there is no dim button: the page dims automatically whenever the spotlight is in use (while picking, or whenever at least one element is selected), and the dim survives into the capture.
- **Outline** — draw an accent border around each spotlit element; pick the color from the recent-color circles or a custom color picker.
- **Settings** — a popover (the color swatch button) with the color circles plus **Padding**, **Line thickness**, **Border radius**, and **Background dim** sliders. **Reset** restores them to defaults.
- **Undo** — step back one selection change (pick / unpick / clear / re-applied settings) while in Select mode.
- **Capture** — grab the visible viewport (the toolbar hides itself and the page push-down is dropped first) into a save modal.
- **Crop** — in the save modal, drag a region of the captured image and **Apply** to crop; **Reset crop** restores the original capture.
- **Save as / Download / Copy** — native save dialog, one-click timestamped download, or PNG to the clipboard.
- **Persistence** — settings, recent colors, the spotlight selection, and the open/select state are remembered across reloads (see [Persistence](#persistence)).
- **Works anywhere** — runs on any `http`/`https` page, in any environment (prod / staging / dev).

## Browser compatibility

This extension is built using the standard Chrome Extensions API and can be sideloaded in most Chromium-based browsers, including:

- Google Chrome
- Microsoft Edge
- Brave
- Vivaldi
- Opera
- Arc
- Chromium

## Build & install (load unpacked)

```bash
cd tools/screenshot-extension
pnpm install --ignore-workspace   # standalone; not part of the pnpm workspace
pnpm build                        # bundles src/ -> dist/
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

Press **Ctrl/Cmd+Shift+S** (or click the extension's toolbar icon) to toggle the
tool on the current tab. The toolbar floats at the top and pushes the page down
rather than covering it; its controls are centered, with a clear **✕** pinned to
the right to exit.

### Toolbar controls

- **Select** (center) — enter/leave spotlight mode. While picking, click page
  elements to spotlight them; click a spotlit element again to remove it. **Esc**
  stops picking.
- **Undo** (left, in Select mode) — step back one selection change: a pick,
  an unpick, a **Clear**, or a settings re-apply. Enabled only while in Select
  mode and only when there is a prior state to return to.
- **Color & settings** swatch (left) — opens the settings popover (see below).
  The swatch shows the current outline color.
- **Clear** (right) — remove every spotlight at once (itself undoable).
- **Capture** (camera, right) — take the screenshot and open the save modal.

Dimming is automatic — there is no dim button. The page dims whenever the
spotlight is in use (while picking, or whenever at least one element is
selected), so the dim is present in the captured image.

### Settings popover

Open it from the color swatch button. It holds the color circles on top and four
sliders below, then a footer with **Set hotkey** and **Reset**.

All four settings are **per-pick**: they seed the *next* element you spotlight.
Elements already spotlit keep the values they were picked with, so changing a
slider never disturbs existing selections.

- **Color circles** — the first circle is always **Transparent** (an on-screen
  dashed guide that is omitted from the capture, i.e. "no outline"). The next
  circles are the **last 4 recently-used colors**, most recent first (white
  seeds the list by default). The last control is a **custom color picker**;
  picking a color promotes it to the front of the recent list.
- **Padding** — extra breathing room around each spotlit element.
- **Line thickness** — outline border width.
- **Border radius** — corner rounding of the cutout and outline.
- **Background dim** — dim strength (shown as a percentage).

Each slider snaps to a few discrete stops while dragging, but you can **click its
numeric readout to type a custom value** within the slider's allowed range
(Padding 0–100, Line thickness 1–100, Border radius 0–100, Background dim
0–100%). **Enter** commits the typed value; **Esc** cancels the edit.

**Set hotkey** opens `chrome://extensions/shortcuts` so you can rebind or clear
the toggle shortcut. **Reset** returns the current color to white and all four
sliders to their defaults; it leaves the saved color history untouched and is
disabled when everything is already at its default.

### Capture & the save modal

**Capture** hides the toolbar and drops the page push-down first, then grabs the
visible viewport via `chrome.tabs.captureVisibleTab` — pixel-perfect, viewport
only (full-page stitching is not implemented yet). It opens the save modal, which
has a filename field, the captured-image preview (click to expand full-screen),
a crop row, and the **Save as / Download / Copy** actions.

#### Cropping

The crop row sits below the preview. Press **Crop** to enter crop mode: a
selection appears covering the whole image — drag its edges or corners (or drag a
new region) to shrink it. **Apply** re-renders the cropped pixels as the new
image; **Cancel** leaves crop mode without changing anything. Once cropped,
**Reset crop** restores the original, untouched capture. Save/Download/Copy are
disabled while cropping, so the only choices are Apply or Cancel.

#### Save targets

- **Save as** opens the browser's native save dialog, so you choose any location
  and confirm the filename (defaults to `screenshot-<timestamp>.png`).
- **Download** writes that same flat, timestamped file straight to the browser's
  download directory — no dialog.
- **Copy** puts the PNG on the clipboard.

## Persistence

State is kept in the page's own storage (per-origin), validated on read, and
best-effort (failures are ignored). There is no syncing across machines.

- **`localStorage` (survives across browser sessions, shared by origin):**
  - Settings — padding, line thickness, border radius, background dim.
  - Current outline color and the **recent-colors** list (up to 4).
  - Whether the toolbar opens in **Select** mode.
- **`sessionStorage` (per-tab; cleared when the tab closes):**
  - Whether the toolbar is **open** — so a full page reload re-opens it where it
    was, without leaking the open state to other tabs.
  - The **spotlight selection** and its **undo history**, keyed per pathname.
    Each pick is stored as a robust CSS selector plus the color/padding/thickness/
    radius chosen for it, then re-resolved on the next activation — so picks
    survive reloads and round-trip navigations (click a link, come back).
    Elements that no longer exist on the page are skipped on restore.

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
