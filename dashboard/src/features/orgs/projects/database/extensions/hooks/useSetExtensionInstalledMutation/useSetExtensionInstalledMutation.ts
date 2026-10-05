import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'node-pg-format';
import { toast } from 'react-hot-toast';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { POSTGRES_FUNCTIONS_QUERY_KEY } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/constants';
import { POSTGRES_EXTENSIONS_QUERY_KEY } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export type ExtensionChange =
  | {
      name: string;
      installed: true;
      /**
       * SQL that installs the extension, run verbatim.
       */
      sql: string;
    }
  | { name: string; installed: false };

function asPostgres(statement: string): string {
  return `SET ROLE postgres;\n${statement};\nRESET ROLE;`;
}

export function getInstallExtensionSQL(name: string, version?: string): string {
  return asPostgres(
    version
      ? format('CREATE EXTENSION IF NOT EXISTS %I VERSION %L', name, version)
      : format('CREATE EXTENSION IF NOT EXISTS %I', name),
  );
}

export function buildExtensionMigration(
  change: ExtensionChange,
  dataSource: string,
) {
  // Never SQL `CASCADE`: dropping fails while other objects depend on it.
  const dropSQL = asPostgres(
    format('DROP EXTENSION IF EXISTS %I', change.name),
  );
  const [up, down] = change.installed
    ? [change.sql.trim(), dropSQL]
    : [dropSQL, getInstallExtensionSQL(change.name)];
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

        throw new Error(normalizeQueryError(body));
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
