import { PROTECTED_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';

export default function isExtensionBuiltIn(
  extension: PostgresExtension,
): boolean {
  return (
    extension.installed_version !== null &&
    PROTECTED_EXTENSIONS.has(extension.name)
  );
}
