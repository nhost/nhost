import { GAP, ICON, PAD } from './geometry';

/**
 * The toolbar's styles, carried as a string and mounted in a `<style>` inside
 * the toolbar's own root.
 *
 * A dev dependency cannot ask for a CSS import: the consumer's bundler may not
 * handle one, and the toolbar has to look the same in a Next app, a Vite app
 * and a plain HTML page. Every declaration is scoped under `.ndt-*` so nothing
 * here reaches the page around it.
 */
export const TOOLBAR_CSS = `
.ndt-root {
  --ndt-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ndt-ink: #f5f5f7;
  --ndt-accent: #4c9bff;
  --ndt-surface: rgba(22, 24, 28, 0.94);
  --ndt-text: #f5f5f7;
  --ndt-muted: rgba(245, 245, 247, 0.6);
  --ndt-border: rgba(255, 255, 255, 0.12);
  --ndt-menu-hover: rgba(255, 255, 255, 0.08);
  z-index: 2147483000;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1;
  color: var(--ndt-ink);
}
.ndt-root[data-theme='light'] {
  --ndt-ink: #16181c;
  --ndt-accent: #0060df;
  --ndt-surface: rgba(255, 255, 255, 0.95);
  --ndt-text: #16181c;
  --ndt-muted: rgba(22, 24, 28, 0.55);
  --ndt-border: rgba(0, 0, 0, 0.1);
  --ndt-menu-hover: rgba(0, 0, 0, 0.05);
}

.ndt-strip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${GAP}px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.ndt-root[data-dragging='true'] .ndt-strip {
  cursor: grabbing;
}
.ndt-root[data-edge='left'] .ndt-strip,
.ndt-root[data-edge='right'] .ndt-strip {
  flex-direction: column;
  padding: ${PAD}px 0;
}
.ndt-root[data-edge='top'] .ndt-strip,
.ndt-root[data-edge='bottom'] .ndt-strip {
  flex-direction: row;
  padding: 0 ${PAD}px;
}

.ndt-handle {
  display: grid;
  place-items: center;
  width: ${ICON}px;
  height: ${ICON}px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ndt-ink);
  cursor: pointer;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.ndt-root[data-dragging='true'] .ndt-handle,
.ndt-root[data-dragging='true'] .ndt-item {
  cursor: grabbing;
}
.ndt-handle:focus-visible {
  outline: 2px solid var(--ndt-accent);
  outline-offset: 2px;
}

.ndt-item {
  position: relative;
  display: grid;
  place-items: center;
  width: ${ICON}px;
  height: ${ICON}px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ndt-ink);
  cursor: pointer;
  text-decoration: none;
  transition: color 0.2s ease-in-out;
}
.ndt-item:hover {
  color: var(--ndt-accent);
}
.ndt-item:focus-visible {
  outline: 2px solid var(--ndt-accent);
  outline-offset: 2px;
}

/* A single shared tooltip that slides between items instead of one per item. */
.ndt-tooltip {
  position: absolute;
  padding: 5px 9px;
  border-radius: 8px;
  background: var(--ndt-surface);
  color: var(--ndt-text);
  border: 1px solid var(--ndt-border);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  transition:
    opacity 0.2s ease-in-out,
    top 0.2s ease-in-out,
    left 0.2s ease-in-out;
}
.ndt-tooltip[data-show='true'] {
  opacity: 1;
}

.ndt-card {
  position: absolute;
  width: 268px;
  max-height: min(80vh, 460px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--ndt-border);
  border-radius: 16px;
  background: var(--ndt-surface);
  backdrop-filter: blur(16px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transform: scale(0.9);
  transition:
    transform 0.42s var(--ndt-spring),
    opacity 0.24s ease;
  pointer-events: none;
}
.ndt-card[data-open='true'] {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.ndt-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ndt-card-title {
  font-size: 14px;
  font-weight: 600;
}
.ndt-icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ndt-border);
  border-radius: 8px;
  background: transparent;
  color: var(--ndt-text);
  cursor: pointer;
  transition: background 0.15s ease;
}
.ndt-icon-btn:hover {
  background: var(--ndt-menu-hover);
}
.ndt-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ndt-field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ndt-muted);
}
.ndt-segment {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--ndt-border);
  border-radius: 10px;
  background: var(--ndt-menu-hover);
}
.ndt-segment button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ndt-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.25s var(--ndt-spring),
    color 0.2s ease;
}
.ndt-segment button[data-active='true'] {
  background: var(--ndt-surface);
  color: var(--ndt-text);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.ndt-hide-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 34px;
  border: 1px solid var(--ndt-border);
  border-radius: 10px;
  background: transparent;
  color: var(--ndt-text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.ndt-hide-btn:hover {
  background: var(--ndt-menu-hover);
}
.ndt-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--ndt-muted);
}
.ndt-note code {
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
}
@media (prefers-reduced-motion: reduce) {
  .ndt-item,
  .ndt-card,
  .ndt-segment button {
    transition-duration: 0.01ms !important;
  }
}
`;
