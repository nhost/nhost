import { useEffect } from 'react';
import { drawProjectFavicon } from '@/features/project-colors/lib/drawProjectFavicon';
import type { ProjectColor } from '@/features/project-colors/lib/palette';

/**
 * Swaps the browser tab icon for the project's color while the project is
 * open, and puts the default icon back when it closes or loses its color.
 */
export default function useProjectFavicon(color?: ProjectColor) {
  useEffect(() => {
    if (!color) {
      return undefined;
    }

    const dataUrl = drawProjectFavicon(color.iconBackground, color.iconLogo);

    if (!dataUrl) {
      return undefined;
    }

    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    );
    const originalHrefs = links.map((link) => link.getAttribute('href') ?? '');

    for (const link of links) {
      link.setAttribute('href', dataUrl);
    }

    return () => {
      links.forEach((link, index) => {
        link.setAttribute('href', originalHrefs[index]);
      });
    };
  }, [color]);
}
