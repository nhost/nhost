function hexChannel(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

export function normalizeColor(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (/^#[0-9a-f]{3,4}$/.test(value)) {
    return `#${[...value.slice(1)].map((digit) => digit + digit).join('')}`;
  }
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(value)) {
    return value;
  }
  const hsl =
    /^hsl\(\s*(-?(?:\d+\.?\d*|\.\d+))(?:deg)?\s*[,\s]+\s*(\d+(?:\.\d+)?)%\s*[,\s]+\s*(\d+(?:\.\d+)?)%\s*(?:\/\s*(\d+(?:\.\d+)?%?))?\s*\)$/.exec(
      value,
    );
  if (!hsl) {
    return null;
  }
  const hue = ((Number(hsl[1]) % 360) + 360) % 360;
  const saturation = Number(hsl[2]) / 100;
  const lightness = Number(hsl[3]) / 100;
  if (saturation > 1 || lightness > 1) {
    return null;
  }
  const alpha = hsl[4]
    ? Number(hsl[4].replace('%', '')) / (hsl[4].endsWith('%') ? 100 : 1)
    : 1;
  if (alpha > 1 || alpha < 0) {
    return null;
  }
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const [red, green, blue] =
    hue < 60
      ? [chroma, secondary, 0]
      : hue < 120
        ? [secondary, chroma, 0]
        : hue < 180
          ? [0, chroma, secondary]
          : hue < 240
            ? [0, secondary, chroma]
            : hue < 300
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return `#${hexChannel((red + offset) * 255)}${hexChannel((green + offset) * 255)}${hexChannel((blue + offset) * 255)}${alpha < 1 ? hexChannel(alpha * 255) : ''}`;
}
