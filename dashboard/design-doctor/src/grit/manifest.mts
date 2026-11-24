import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  biomeVersion: z.string(),
  scope: z.object({ includes: z.array(z.string()).min(1) }),
  rules: z.array(
    z.object({
      id: z.string().regex(/^[a-z-]+$/),
      version: z.number().int().positive(),
      category: z.string(),
      weight: z.number().positive(),
      subject: z.string(),
      docs: z.string(),
    }),
  ),
});
export type Manifest = z.infer<typeof manifestSchema>;

export async function loadManifest(): Promise<Manifest> {
  return manifestSchema.parse(
    JSON.parse(
      await readFile(new URL('../../manifest.json', import.meta.url), 'utf8'),
    ),
  );
}

// Biome matches plugin includes against absolute paths. Use the same ordered globs
// for the doctor's future expected-file set, rather than a second scope list.
function glob(pattern: string): RegExp {
  const expression = pattern
    .split(/(\*\*\/|\*\*|\*)/)
    .map((part) => {
      if (part === '**/') {
        return '(?:.*/)?';
      }
      if (part === '**') {
        return '.*';
      }
      if (part === '*') {
        return '[^/]*';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${expression}$`);
}

export function inScope(path: string, scope: Manifest['scope']): boolean {
  const absolute = path.replaceAll('\\', '/');
  let included = false;
  for (const entry of scope.includes) {
    const excluded = entry.startsWith('!');
    if (glob(excluded ? entry.slice(1) : entry).test(absolute)) {
      included = !excluded;
    }
  }
  return included;
}

export function vocabularyHash(values: unknown): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
