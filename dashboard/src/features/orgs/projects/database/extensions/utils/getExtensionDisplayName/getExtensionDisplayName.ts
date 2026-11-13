// The docs title the `vector` section "pgvector", so the UI does too.
const DISPLAY_NAMES = new Map([['vector', 'pgvector']]);

export default function getExtensionDisplayName(name: string): string {
  return DISPLAY_NAMES.get(name) ?? name;
}
