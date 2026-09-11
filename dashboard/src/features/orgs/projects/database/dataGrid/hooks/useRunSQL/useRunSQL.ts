import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { POSTGRES_FUNCTIONS_QUERY_KEY } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import showErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/show-error-toast';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import {
  throwIfMetadataVersionConflict,
  throwIfMigrationMetadataVersionConflict,
} from '@/utils/hasura-api/legacy-metadata-conflict';
import { isMetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';
import { parseIdentifiersFromSQL } from '@/utils/sql';

export default function useRunSQL(
  sqlCode: string,
  track: boolean,
  cascade: boolean,
  readOnly: boolean,
  isMigration: boolean,
  migrationName: string,
) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [commandOk, setCommandOk] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([[]]);

  const router = useRouter();

  const {
    query: { dataSourceSlug },
  } = router;

  const { refetch } = useDatabaseQuery([dataSourceSlug as string]);

  const appUrl = adminApi!.appUrl;

  const adminSecret = adminApi!.adminSecret;

  const toastStyle = getToastStyleProps();

  const createMigration = async (
    inputSQL: string,
    migration: string,
    isCascade: boolean,
  ) => {
    try {
      const url = isPlatform
        ? `${appUrl}/apis/migrate`
        : getHasuraMigrationsApiUrl();
      const migrationApiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'x-hasura-admin-secret': adminSecret },
        body: JSON.stringify({
          name: migration,
          datasource: 'default',
          up: [
            {
              type: 'run_sql',
              args: {
                source: 'default',
                sql: inputSQL,
                cascade: isCascade,
                read_only: false,
              },
            },
          ],
          down: [
            {
              type: 'run_sql',
              args: {
                source: 'default',
                sql: '-- Could not auto-generate a down migration.',
                cascade: isCascade,
                read_only: false,
              },
            },
          ],
        }),
      });

      if (!migrationApiResponse.ok) {
        const responseData: unknown = await migrationApiResponse
          .clone()
          .json()
          .catch(() => null);
        throwIfMigrationMetadataVersionConflict(
          migrationApiResponse,
          responseData,
          appUrl,
        );
        throw new Error('Migration API call failed');
      }

      return {
        error: null,
      };
    } catch (createMigrationError: unknown) {
      if (isMetadataVersionConflictError(createMigrationError)) {
        throw createMigrationError;
      }

      toast.error('An error happened when calling the migration API', {
        style: toastStyle.style,
        ...toastStyle.error,
      });

      return {
        error: createMigrationError,
      };
    }
  };

  const sendSQLToHasura = async (
    inputSQL: string,
    isCascade: boolean,
    isReadOnly: boolean,
  ) => {
    try {
      if (!inputSQL) {
        return {
          result_type: 'error',
          columns: [],
          rows: [],
          queryApiError: 'No SQL provided',
        };
      }

      const response = await fetch(`${appUrl}/v2/query`, {
        method: 'POST',
        headers: { 'x-hasura-admin-secret': adminSecret },
        body: JSON.stringify({
          type: 'run_sql',
          args: {
            source: 'default',
            sql: inputSQL,
            cascade: isCascade,
            read_only: isReadOnly,
          },
        }),
      });

      if (!response.ok) {
        const errorResponse = await response.json();
        throwIfMetadataVersionConflict(response, errorResponse, appUrl);
        const queryApiError =
          errorResponse?.internal?.error?.message || 'Unknown error';
        return {
          result_type: 'error',
          columns: [],
          rows: [],
          error: queryApiError,
        };
      }

      const responseBody = await response.json();

      if (responseBody?.result_type === 'TuplesOk') {
        return {
          result_type: 'TuplesOk',
          columns: responseBody.result[0],
          rows: responseBody.result.slice(1),
          error: '',
        };
      }

      if (responseBody?.result_type === 'CommandOk') {
        return {
          result_type: 'CommandOk',
          columns: [],
          rows: [],
          error: '',
        };
      }

      // If the result_type is neither TuplesOk nor CommandOk
      return {
        result_type: 'error',
        columns: [],
        rows: [],
        error: 'Unknown response type',
      };
    } catch (error: unknown) {
      if (isMetadataVersionConflictError(error)) {
        throw error;
      }

      return {
        result_type: 'error',
        columns: [],
        rows: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  // biome-ignore lint/suspicious/noExplicitAny: TODO
  const trackAll = async (objects: any[]): Promise<Response[]> => {
    const url = isPlatform
      ? `${appUrl}/v1/metadata`
      : getHasuraMigrationsApiUrl();
    const settledResponses = await Promise.allSettled(
      objects.map(async (object) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'x-hasura-admin-secret': adminSecret },
          body: JSON.stringify(object),
        });

        if (!response.ok) {
          const responseData: unknown = await response
            .clone()
            .json()
            .catch(() => null);

          if (isPlatform) {
            throwIfMetadataVersionConflict(response, responseData, appUrl);
          } else {
            throwIfMigrationMetadataVersionConflict(
              response,
              responseData,
              appUrl,
            );
          }

          console.error('failed to track:', response);
        }

        return response;
      }),
    );

    const conflict = settledResponses.find(
      (result) =>
        result.status === 'rejected' &&
        isMetadataVersionConflictError(result.reason),
    );

    if (conflict?.status === 'rejected') {
      console.error('Error in trackAll:', conflict.reason);
      throw conflict.reason;
    }

    const failure = settledResponses.find(
      (result) => result.status === 'rejected',
    );

    if (failure?.status === 'rejected') {
      console.error('Error in trackAll:', failure.reason);
      throw failure.reason;
    }

    return settledResponses.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      throw result.reason;
    });
  };

  const updateMetadata = async (inputSQL: string) => {
    const entities = parseIdentifiersFromSQL(inputSQL);
    if (entities.length === 0) {
      return;
    }

    const tablesOrViewEntities = entities.filter(
      (entity) => entity.type !== 'function',
    );
    const functionEntities = entities.filter(
      (entity) => entity.type === 'function',
    );

    // biome-ignore lint/suspicious/noExplicitAny: TODO
    let trackTablesOrViews: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    let trackFunctions: any[] = [];
    if (isPlatform) {
      // use v2/query
      trackTablesOrViews = tablesOrViewEntities.map(({ name, schema }) => ({
        type: 'pg_track_table',
        args: {
          source: 'default',
          table: {
            name,
            schema,
          },
        },
      }));
      trackFunctions = functionEntities.map(({ name, schema }) => ({
        type: 'pg_track_function',
        args: {
          source: 'default',
          function: {
            name,
            schema,
            configuration: {},
          },
        },
      }));
    } else {
      // use apis/migrate
      trackTablesOrViews = tablesOrViewEntities.map(({ name, schema }) => ({
        name: `add_existing_table_or_view_${schema}_${name}`,
        datasource: 'default',
        down: [],
        skip_execution: false,
        up: [
          {
            type: 'pg_track_table',
            args: {
              table: { name, schema },
              source: 'default',
            },
          },
        ],
      }));
      trackFunctions = functionEntities.map(({ name, schema }) => ({
        name: `add_existing_function_or_view_${schema}_${name}`,
        datasource: 'default',
        down: [],
        skip_execution: false,
        up: [
          {
            type: 'pg_track_function',
            args: {
              function: { name, schema },
              source: 'default',
            },
          },
        ],
      }));
    }

    try {
      await trackAll([...trackTablesOrViews, ...trackFunctions]).then(
        (responses) => {
          responses.forEach((response) => {
            if (!response.ok) {
              console.error('Error tracking table or view:', response);
            }
          });
        },
      );
    } catch (error: unknown) {
      if (isMetadataVersionConflictError(error)) {
        throw error;
      }

      toast.error('An error happened when calling the metadata API', {
        style: toastStyle.style,
        ...toastStyle.error,
      });
    }
  };

  const runSQL = async (): Promise<boolean> => {
    setLoading(true);
    setCommandOk(false);
    setErrorMessage('');

    try {
      let succeeded = false;

      if (isMigration) {
        const { error: createMigrationError } = await createMigration(
          sqlCode,
          migrationName,
          cascade,
        );

        succeeded = !createMigrationError;

        if (createMigrationError) {
          setErrorMessage('An unknown error occurred');
        }

        if (track && succeeded) {
          await updateMetadata(sqlCode);
        }

        setCommandOk(succeeded);
      } else {
        const {
          result_type,
          error: $error,
          columns: $columns,
          rows: $rows,
        } = await sendSQLToHasura(sqlCode, cascade, readOnly);

        succeeded = result_type !== 'error';
        setColumns($columns);
        setRows($rows);
        setErrorMessage($error);

        if (track && !$error) {
          await updateMetadata(sqlCode);
        }

        setCommandOk(result_type === 'CommandOk');
      }

      await refetch();
      await queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      });
      await queryClient.invalidateQueries({
        queryKey: [POSTGRES_FUNCTIONS_QUERY_KEY, project?.subdomain],
      });

      return succeeded;
    } catch (error: unknown) {
      if (isMetadataVersionConflictError(error)) {
        setCommandOk(false);
        showErrorToast(error, error.message);
        return false;
      }

      throw error;
    } finally {
      setLoading(false);
    }
  };

  const reset = useCallback(() => {
    setCommandOk(false);
    setErrorMessage('');
    setColumns([]);
    setRows([[]]);
  }, []);

  return {
    runSQL,
    reset,
    loading,
    errorMessage,
    commandOk,
    rows,
    columns,
  };
}
