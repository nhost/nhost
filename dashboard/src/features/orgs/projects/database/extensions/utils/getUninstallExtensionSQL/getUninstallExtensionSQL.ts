import { format } from 'node-pg-format';
import { CASCADE_UNINSTALL_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import { withPostgresRole } from '@/features/orgs/projects/database/extensions/utils/withPostgresRole';

// Only extensions that cannot be dropped otherwise use SQL `CASCADE`; for the
// rest, dropping fails while other objects depend on the extension.
export default function getUninstallExtensionSQL(name: string): string {
  const statement = format('DROP EXTENSION IF EXISTS %I', name);

  return withPostgresRole(
    CASCADE_UNINSTALL_EXTENSIONS.has(name) ? `${statement} CASCADE` : statement,
  );
}
