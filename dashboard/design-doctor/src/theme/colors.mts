/**
 * MIT-licensed code from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../NOTICE.md.
 */
// CSS color parsing into OKLab, so a raw color can be compared with the
// theme's tokens. OKLab is perceptually uniform enough that a plain
// Euclidean distance says whether two colors are "the same gray" or
// "the same red", which is all a suggestion needs.

export type Lab = [number, number, number];

// The CSS named colors, as sRGB hex.
const NAMED: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  grey: '#808080',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

export const namedColors = Object.keys(NAMED);

function linear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromRgb(r: number, g: number, b: number): Lab {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromHwb(h: number, w: number, b: number): Lab {
  if (w + b >= 1) {
    const gray = w / (w + b);
    return fromRgb(gray, gray, gray);
  }
  const [r, g, bl] = hslToRgb(h, 1, 0.5);
  const scale = (c: number) => c * (1 - w - b) + w;
  return fromRgb(scale(r), scale(g), scale(bl));
}

function hslToRgb(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function fromHsl(h: number, s: number, l: number): Lab {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return fromRgb(f(0), f(8), f(4));
}

function fromHex(hex: string): Lab | null {
  let digits = hex.slice(1);
  if (digits.length === 3 || digits.length === 4) {
    digits = [...digits].map((d) => d + d).join('');
  }
  if (digits.length !== 6 && digits.length !== 8) {
    return null;
  }
  if (!/^[0-9a-f]+$/i.test(digits)) {
    return null;
  }
  const n = parseInt(digits.slice(0, 6), 16);
  return fromRgb(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}

// The arguments of a color function, with the alpha channel dropped.
// Accepts both the modern space syntax and the legacy comma syntax.
function args(inner: string) {
  const [channels] = inner.split('/');
  return channels
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3);
}

// A channel given as a number or a percentage, scaled to `scale` for
// the number form and to 0..1 for percentages, times `percentScale`.
function channel(raw: string, scale: number, percentScale = 1) {
  // CSS `none` is a missing channel, computed as zero. Tailwind's own
  // theme writes it for achromatic entries: oklch(55.6% 0 none).
  if (raw === 'none') {
    return 0;
  }
  if (raw.endsWith('%')) {
    const value = Number(raw.slice(0, -1));
    return Number.isFinite(value) ? (value / 100) * percentScale : null;
  }
  const value = Number(raw.replace(/deg$/, ''));
  return Number.isFinite(value) ? value / scale : null;
}

// Whether a value is one of the CSS named colors (fill="red"). The
// same list parseColor resolves, so the two never disagree about what
// counts as a color name.
export function isNamedColor(value: string) {
  return Object.hasOwn(NAMED, value.trim().toLowerCase());
}

// Parses a CSS color into OKLab, or null for anything that is not a
// literal color (variables, color-mix, keywords like currentColor).
export function parseColor(value: string): Lab | null {
  const text = value.trim().toLowerCase();
  if (!text) {
    return null;
  }
  if (text.startsWith('#')) {
    return fromHex(text);
  }
  const named = NAMED[text];
  if (named) {
    return fromHex(named);
  }
  const match = text.match(/^([a-z]+)\((.*)\)$/s);
  if (!match) {
    return null;
  }
  const [, fn, inner] = match;
  const parts = args(inner);
  if (parts.length < 3) {
    return null;
  }
  switch (fn) {
    case 'rgb':
    case 'rgba': {
      const [r, g, b] = parts.map((p) => channel(p, 255));
      if (r === null || g === null || b === null) {
        return null;
      }
      return fromRgb(r, g, b);
    }
    case 'hsl':
    case 'hsla': {
      const h = channel(parts[0], 1);
      const s = channel(parts[1], 100);
      const l = channel(parts[2], 100);
      if (h === null || s === null || l === null) {
        return null;
      }
      return fromHsl(h, s, l);
    }
    case 'hwb': {
      const h = channel(parts[0], 1);
      const w = channel(parts[1], 100);
      const b = channel(parts[2], 100);
      if (h === null || w === null || b === null) {
        return null;
      }
      return fromHwb(h, w, b);
    }
    case 'oklch': {
      const l = channel(parts[0], 1);
      const c = channel(parts[1], 1, 0.4);
      const h = channel(parts[2], 1);
      if (l === null || c === null || h === null) {
        return null;
      }
      const rad = (h * Math.PI) / 180;
      return [l, c * Math.cos(rad), c * Math.sin(rad)];
    }
    case 'oklab': {
      const l = channel(parts[0], 1);
      const a = channel(parts[1], 1, 0.4);
      const b = channel(parts[2], 1, 0.4);
      if (l === null || a === null || b === null) {
        return null;
      }
      return [l, a, b];
    }
    case 'color': {
      if (parts[0] !== 'srgb') {
        return null;
      }
      const rest = args(inner.replace(/^\s*srgb\s+/, ''));
      const [r, g, b] = rest.map((p) => channel(p, 1));
      if (r == null || g == null || b == null) {
        return null;
      }
      return fromRgb(r, g, b);
    }
    default:
      return null;
  }
}

// Perceptual distance between two colors. Roughly: under 0.02 is the
// same color, under 0.1 is the same color family.
export function colorDistance(a: Lab, b: Lab) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
