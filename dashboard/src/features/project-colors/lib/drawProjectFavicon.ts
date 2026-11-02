import { NHOST_LOGO_PATH } from '@/features/project-colors/lib/nhostLogoPath';

const SIZE = 64;

/**
 * Paints the tab icon for a project color: a rounded square in the color
 * with the Nhost logo on top, returned as a PNG data URL so every browser can
 * show it. Returns null when the browser can't draw it.
 */
export function drawProjectFavicon(background: string, logo: string) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.fillStyle = background;
  context.beginPath();
  context.roundRect(0, 0, SIZE, SIZE, 14);
  context.fill();

  // The logo is 30 by 32: scale it to 40px tall and center it.
  context.translate(13.25, 12);
  context.scale(1.25, 1.25);
  context.fillStyle = logo;
  context.fill(new Path2D(NHOST_LOGO_PATH));

  return canvas.toDataURL('image/png');
}
