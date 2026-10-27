import type { CSSProperties } from 'react';

// Recharts portals the tooltip and the legend into the same wrapper as
// absolutely positioned siblings without a z-index, so the legend (mounted
// later) would otherwise paint over the tooltip.
export const TOOLTIP_WRAPPER_STYLE: CSSProperties = { zIndex: 20 };
