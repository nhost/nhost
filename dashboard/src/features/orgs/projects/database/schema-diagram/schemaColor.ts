/** Per-schema color as RGB channels separated by spaces, e.g. "59 130 246".
 * Designed to be plugged into a CSS custom property and consumed by Tailwind
 * arbitrary values via `rgb(var(--schema-color) / <alpha>)`. */

const KNOWN_SCHEMA_COLORS: Record<string, string> = {
  public: '59 130 246',
  auth: '168 85 247',
  storage: '16 185 129',
  graphite: '236 72 153',
};

const PALETTE = [
  '244 114 182',
  '251 146 60',
  '250 204 21',
  '132 204 22',
  '34 211 238',
  '96 165 250',
  '167 139 250',
  '45 212 191',
];

export function getSchemaColor(schema: string): string {
  if (KNOWN_SCHEMA_COLORS[schema]) {
    return KNOWN_SCHEMA_COLORS[schema];
  }

  let hash = 0;
  for (let i = 0; i < schema.length; i += 1) {
    hash = (hash * 31 + schema.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
