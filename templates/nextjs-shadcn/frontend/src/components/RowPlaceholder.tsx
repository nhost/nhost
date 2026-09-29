/** The box the motif is drawn in. Square, matching the media slot. */
const SIZE = 64;

/** How finely each curve is sampled. Small enough to read as a smooth line. */
const STEP = 2;

/**
 * The five motifs, as parameters rather than as drawings.
 *
 * Each is a stack of sine curves: `lines` of them down the square, `amplitude`
 * tall and `wavelength` apart, with `drift` turning the phase a little further
 * on every line down. That last one is what makes the stack look like contours
 * of something rather than like ruled paper - neighbouring lines stay roughly
 * parallel but never quite, the way the reference does.
 *
 * Five rather than three because the list cycles through them by position, and
 * at three a list of any length reads as one repeating trio. Five is long
 * enough that the repeat is not the first thing you notice, and they are
 * spread across the range - dense and shallow through to sparse and deep - so
 * consecutive rows never look like the same drawing twice.
 */
const MOTIFS = [
  { lines: 9, amplitude: 5, wavelength: 62, drift: 0.55, weight: 0.9 },
  { lines: 13, amplitude: 3, wavelength: 34, drift: 0.32, weight: 0.7 },
  { lines: 7, amplitude: 7.5, wavelength: 88, drift: 0.85, weight: 1.1 },
  { lines: 11, amplitude: 4, wavelength: 46, drift: 0.7, weight: 0.8 },
  { lines: 6, amplitude: 9, wavelength: 118, drift: 1.05, weight: 1.25 },
] as const;

/**
 * One wave, sampled left to right.
 *
 * The curve is allowed to run past both edges - it starts at `-STEP` and ends
 * past `SIZE` - so the lines are cut off by the square rather than stopping
 * inside it, which is what makes the motif read as a crop of something larger.
 */
function wave(
  y: number,
  amplitude: number,
  wavelength: number,
  phase: number,
): string {
  const points: string[] = [];

  for (let x = -STEP; x <= SIZE + STEP; x += STEP) {
    const offset = amplitude * Math.sin((x / wavelength) * Math.PI * 2 + phase);
    points.push(`${x} ${(y + offset).toFixed(2)}`);
  }

  return `M ${points.join(' L ')}`;
}

/**
 * What fills the media slot when a row has no photo.
 *
 * Drawn rather than stored: three motifs computed from a handful of numbers,
 * so there are no image assets to ship and no second set of them for dark
 * mode. It is an inline `<svg>` and not a `background-image` data URI for
 * exactly that last reason - inline, the strokes can be `currentColor` and the
 * caller picks the weight with a text colour, which then follows the theme on
 * its own.
 *
 * The motif is chosen by position, so a list cycles through the five instead
 * of repeating one, and any given row draws the same one every render.
 */
export function RowPlaceholder({
  index,
  className,
}: {
  index: number;
  className?: string;
}) {
  const motif = MOTIFS[index % MOTIFS.length] ?? MOTIFS[0];
  const spacing = SIZE / (motif.lines - 1);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="none"
      aria-hidden
      className={className}
    >
      <title>No photo</title>
      {Array.from({ length: motif.lines }, (_, line) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: the line's position in the stack is its identity
          key={line}
          d={wave(
            line * spacing,
            motif.amplitude,
            motif.wavelength,
            line * motif.drift + index,
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={motif.weight}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
