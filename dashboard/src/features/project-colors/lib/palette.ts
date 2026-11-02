/**
 * The project colors a person can pick, in pairs: a light and a dark tone of
 * each hue, so two tones of the same hue are always easy to tell apart.
 * Nhost blue is left out on purpose: it is the default tab icon, so a blue
 * project would look like a project with no color.
 *
 * These are identity colors, like chart colors, not theme tokens: each one
 * names its own values for the bar in light and dark mode and for the tab
 * icon, which sits in the browser's tab strip, outside the app's theme.
 */
export interface ProjectColor {
  id: string;
  name: string;
  /** The bar in light mode. */
  bar: string;
  /** A thin line under the bar in light mode, so light tones stay visible on white. */
  barEdge?: string;
  /** The bar in dark mode. Dark tones get brighter here so they don't vanish. */
  barDark: string;
  /** The tab icon: tag background and logo, at least 4.5:1 contrast (WCAG AA). */
  iconBackground: string;
  iconLogo: string;
}

interface Hue {
  key: string;
  name: string;
  tone300: string;
  tone600: string;
  tone800: string;
  tone950: string;
}

const HUES: Hue[] = [
  {
    key: 'red',
    name: 'red',
    tone300: '#fca5a5',
    tone600: '#dc2626',
    tone800: '#991b1b',
    tone950: '#450a0a',
  },
  {
    key: 'orange',
    name: 'orange',
    tone300: '#fdba74',
    tone600: '#ea580c',
    tone800: '#9a3412',
    tone950: '#431407',
  },
  {
    key: 'yellow',
    name: 'yellow',
    tone300: '#fde047',
    tone600: '#ca8a04',
    tone800: '#854d0e',
    tone950: '#422006',
  },
  {
    key: 'lime',
    name: 'lime',
    tone300: '#bef264',
    tone600: '#65a30d',
    tone800: '#3f6212',
    tone950: '#1a2e05',
  },
  {
    key: 'green',
    name: 'green',
    tone300: '#86efac',
    tone600: '#16a34a',
    tone800: '#166534',
    tone950: '#052e16',
  },
  {
    key: 'teal',
    name: 'teal',
    tone300: '#5eead4',
    tone600: '#0d9488',
    tone800: '#115e59',
    tone950: '#042f2e',
  },
  {
    key: 'sky',
    name: 'light blue',
    tone300: '#7dd3fc',
    tone600: '#0284c7',
    tone800: '#075985',
    tone950: '#082f49',
  },
  {
    key: 'violet',
    name: 'violet',
    tone300: '#c4b5fd',
    tone600: '#7c3aed',
    tone800: '#5b21b6',
    tone950: '#2e1065',
  },
  {
    key: 'pink',
    name: 'pink',
    tone300: '#f9a8d4',
    tone600: '#db2777',
    tone800: '#9d174d',
    tone950: '#500724',
  },
];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const PROJECT_COLORS: ProjectColor[] = HUES.flatMap((hue) => [
  {
    id: `${hue.key}-light`,
    name: `Light ${hue.name}`,
    bar: hue.tone300,
    barEdge: hue.tone600,
    barDark: hue.tone300,
    iconBackground: hue.tone300,
    iconLogo: hue.tone950,
  },
  {
    id: `${hue.key}-dark`,
    name: `Dark ${hue.name}`,
    bar: hue.tone800,
    barDark: hue.tone600,
    iconBackground: hue.tone800,
    iconLogo: '#ffffff',
  },
]).map((color) => ({ ...color, name: capitalize(color.name) }));

/** The default tab icon: Nhost blue with a white logo. */
export const DEFAULT_ICON_COLORS = {
  iconBackground: '#0052cc',
  iconLogo: '#ffffff',
};

export function getProjectColor(id?: string | null) {
  return PROJECT_COLORS.find((color) => color.id === id);
}
