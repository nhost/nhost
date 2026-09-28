const SCALAR_ALIASES: Readonly<Record<string, string>> = {
  character: 'bpchar',
  'character varying': 'varchar',
};

export default function normalizeLogicalModelScalar(
  scalar?: string,
): string | undefined {
  if (!scalar) {
    return undefined;
  }
  const normalized = scalar.toLocaleLowerCase();
  return SCALAR_ALIASES[normalized] ?? normalized;
}
