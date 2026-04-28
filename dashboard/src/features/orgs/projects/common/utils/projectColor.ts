export type ProjectColorName =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'blue'
  | 'violet'
  | 'pink';

export type ProjectColorEntry = {
  name: ProjectColorName;
  label: string;
  swatch: string;
  dot: string;
  border: string;
};

export const PROJECT_COLOR_PALETTE: ProjectColorEntry[] = [
  {
    name: 'red',
    label: 'Red',
    swatch: 'bg-red-500',
    dot: 'bg-red-500',
    border: 'border-red-500',
  },
  {
    name: 'orange',
    label: 'Orange',
    swatch: 'bg-orange-500',
    dot: 'bg-orange-500',
    border: 'border-orange-500',
  },
  {
    name: 'amber',
    label: 'Amber',
    swatch: 'bg-amber-500',
    dot: 'bg-amber-500',
    border: 'border-amber-500',
  },
  {
    name: 'green',
    label: 'Green',
    swatch: 'bg-green-500',
    dot: 'bg-green-500',
    border: 'border-green-500',
  },
  {
    name: 'emerald',
    label: 'Emerald',
    swatch: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500',
  },
  {
    name: 'teal',
    label: 'Teal',
    swatch: 'bg-teal-500',
    dot: 'bg-teal-500',
    border: 'border-teal-500',
  },
  {
    name: 'sky',
    label: 'Sky',
    swatch: 'bg-sky-500',
    dot: 'bg-sky-500',
    border: 'border-sky-500',
  },
  {
    name: 'blue',
    label: 'Blue',
    swatch: 'bg-blue-500',
    dot: 'bg-blue-500',
    border: 'border-blue-500',
  },
  {
    name: 'violet',
    label: 'Violet',
    swatch: 'bg-violet-500',
    dot: 'bg-violet-500',
    border: 'border-violet-500',
  },
  {
    name: 'pink',
    label: 'Pink',
    swatch: 'bg-pink-500',
    dot: 'bg-pink-500',
    border: 'border-pink-500',
  },
];

const PALETTE_BY_NAME = Object.fromEntries(
  PROJECT_COLOR_PALETTE.map((entry) => [entry.name, entry]),
) as Record<ProjectColorName, ProjectColorEntry>;

export function isProjectColorName(value: unknown): value is ProjectColorName {
  return typeof value === 'string' && value in PALETTE_BY_NAME;
}

export function hashAppId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function defaultColorFor(appId: string): ProjectColorName {
  const index = hashAppId(appId) % PROJECT_COLOR_PALETTE.length;
  return PROJECT_COLOR_PALETTE[index].name;
}

export function getColorEntry(name: ProjectColorName): ProjectColorEntry {
  return PALETTE_BY_NAME[name];
}
