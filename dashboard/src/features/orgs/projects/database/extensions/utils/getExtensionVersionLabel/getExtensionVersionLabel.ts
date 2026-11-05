import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';

export default function getExtensionVersionLabel(
  extension: PostgresExtension,
): string | null {
  const { default_version: available, installed_version: installed } =
    extension;

  if (installed === null) {
    return available === null ? null : `v${available}`;
  }

  if (available !== null && available !== installed) {
    return `v${installed} (v${available} available)`;
  }

  return `v${installed}`;
}
