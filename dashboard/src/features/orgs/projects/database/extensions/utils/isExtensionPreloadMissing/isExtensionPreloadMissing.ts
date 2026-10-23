import { PRELOAD_LIBRARY_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';

/**
 * Whether an installed extension needs a library PostgreSQL did not preload.
 * `false` while the preloaded libraries are unknown.
 */
export default function isExtensionPreloadMissing(
  extension: PostgresExtension,
  preloadedLibraries?: string[],
): boolean {
  return (
    extension.installed_version !== null &&
    PRELOAD_LIBRARY_EXTENSIONS.has(extension.name) &&
    preloadedLibraries !== undefined &&
    !preloadedLibraries.includes(extension.name)
  );
}
