import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';

/**
 * Returns the extensions that `CREATE EXTENSION ... CASCADE` installs along
 * with `extension`: its dependencies, and theirs, that are not installed yet.
 */
export default function getMissingExtensionDependencies(
  extension: PostgresExtension,
  catalog: PostgresExtension[],
): string[] {
  const extensionsByName = new Map(catalog.map((item) => [item.name, item]));
  const missing = new Set<string>();
  const pending = [...extension.requires];

  while (pending.length > 0) {
    const dependency = extensionsByName.get(pending.shift() ?? '');

    if (
      dependency &&
      dependency.installed_version === null &&
      !missing.has(dependency.name)
    ) {
      missing.add(dependency.name);
      pending.push(...dependency.requires);
    }
  }

  return [...missing];
}
