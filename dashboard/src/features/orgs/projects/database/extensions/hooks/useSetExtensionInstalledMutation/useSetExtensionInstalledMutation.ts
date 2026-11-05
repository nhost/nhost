import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'node-pg-format';
import { toast } from 'react-hot-toast';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { POSTGRES_FUNCTIONS_QUERY_KEY } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import type { QueryError } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { CASCADE_UNINSTALL_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import { POSTGRES_EXTENSIONS_QUERY_KEY } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export interface ExtensionChange {
  name: string;
  installed: boolean;
  /**
   * SQL that installs or uninstalls the extension, run verbatim.
   */
  sql: string;
}

/**
 * Error from installing or uninstalling an extension, with the PostgreSQL
 * error code when the database rejected the SQL.
 */
export class ExtensionChangeError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ExtensionChangeError';
    this.code = code;
  }
}

// The migrations API wraps the Hasura error in a JSON `message` string.
function getPostgresErrorCode(body: unknown): string | undefined {
  const { internal, message } = (body ?? {}) as Partial<QueryError>;

  if (internal?.error?.status_code) {
    return internal.error.status_code;
  }

  if (typeof message !== 'string') {
    return undefined;
  }

  try {
    return getPostgresErrorCode(JSON.parse(message));
  } catch {
    return undefined;
  }
}

// The role ends with the transaction that runs the SQL, so it cannot outlive
// it on a pooled connection even if the SQL is edited.
function asPostgres(statement: string): string {
  return `SET LOCAL ROLE postgres;\n${statement};`;
}

export interface InstallExtensionOptions {
  /**
   * Also installs the extensions it depends on.
   */
  cascade?: boolean;
}

// Installs the default version, the one bundled with the Postgres image.
export function getInstallExtensionSQL(
  name: string,
  { cascade = false }: InstallExtensionOptions = {},
): string {
  const statement = format('CREATE EXTENSION IF NOT EXISTS %I', name);

  return asPostgres(cascade ? `${statement} CASCADE` : statement);
}

// Only extensions that cannot be dropped otherwise use SQL `CASCADE`; for the
// rest, dropping fails while other objects depend on the extension.
export function getDropExtensionStatement(name: string): string {
  const statement = format('DROP EXTENSION IF EXISTS %I', name);

  return CASCADE_UNINSTALL_EXTENSIONS.has(name)
    ? `${statement} CASCADE`
    : statement;
}

export function getUninstallExtensionSQL(name: string): string {
  return asPostgres(getDropExtensionStatement(name));
}

export function buildExtensionMigration(
  change: ExtensionChange,
  dataSource: string,
) {
  const up = change.sql.trim();
  const down = change.installed
    ? getUninstallExtensionSQL(change.name)
    : getInstallExtensionSQL(change.name);
  // `cascade` cascades Hasura metadata, not SQL objects.
  const runSql = (sql: string) => [
    {
      type: 'run_sql',
      args: { cascade: false, read_only: false, source: dataSource, sql },
    },
  ];
  const action = change.installed ? 'create' : 'drop';

  return {
    name: `${action}_extension_${change.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
    datasource: dataSource,
    skip_execution: false,
    up: runSql(up),
    down: runSql(down),
  };
}

export default function useSetExtensionInstalledMutation(dataSource: string) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ExtensionChange>({
    mutationFn: async (change) => {
      const migration = buildExtensionMigration(change, dataSource);
      const response = await fetch(
        isPlatform
          ? `${adminApi!.appUrl}/v2/query`
          : getHasuraMigrationsApiUrl(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': adminApi!.adminSecret,
          },
          body: JSON.stringify(
            isPlatform
              ? { type: 'bulk', version: 1, args: migration.up }
              : migration,
          ),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({
          error: `Request failed with status ${response.status}.`,
        }));

        throw new ExtensionChangeError(
          normalizeQueryError(body),
          getPostgresErrorCode(body),
        );
      }
    },
    onSuccess: (_data, { name, installed }) => {
      const toastStyle = getToastStyleProps();

      toast.success(
        `${getExtensionDisplayName(name)} has been ${installed ? 'installed' : 'uninstalled'}.`,
        { style: toastStyle.style, ...toastStyle.success },
      );
    },
    // Also after errors: a slow install can time out after Postgres committed.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            POSTGRES_EXTENSIONS_QUERY_KEY,
            project?.subdomain,
            dataSource,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            POSTGRES_FUNCTIONS_QUERY_KEY,
            project?.subdomain,
            dataSource,
          ],
        }),
        queryClient.invalidateQueries({ queryKey: [dataSource] }),
      ]),
  });
}
