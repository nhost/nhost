const KNOWN_SCHEMA_COLORS: Record<string, string> = {
  public: 'rgb(59, 130, 246)',
  auth: 'rgb(168, 85, 247)',
  storage: 'rgb(16, 185, 129)',
  graphql: 'rgb(236, 72, 153)',
  hdb_catalog: 'rgb(100, 116, 139)',
};

const PALETTE = [
  'rgb(244, 114, 182)',
  'rgb(251, 146, 60)',
  'rgb(250, 204, 21)',
  'rgb(132, 204, 22)',
  'rgb(34, 211, 238)',
  'rgb(96, 165, 250)',
  'rgb(167, 139, 250)',
  'rgb(45, 212, 191)',
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
