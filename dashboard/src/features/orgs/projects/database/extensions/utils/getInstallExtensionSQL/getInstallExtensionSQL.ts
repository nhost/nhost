import { format } from 'node-pg-format';
import { withPostgresRole } from '@/features/orgs/projects/database/extensions/utils/withPostgresRole';

// Installs the default version, the one bundled with the Postgres image.
export default function getInstallExtensionSQL(
  name: string,
  { cascade = false }: { cascade?: boolean } = {},
): string {
  const statement = format('CREATE EXTENSION IF NOT EXISTS %I', name);

  return withPostgresRole(cascade ? `${statement} CASCADE` : statement);
}
