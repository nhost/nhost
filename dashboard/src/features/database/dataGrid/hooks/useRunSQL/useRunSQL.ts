import { useDatabaseQuery } from '@/features/database/dataGrid/hooks/useDatabaseQuery';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraAdminSecret } from '@/utils/env';
import { parseIdentifiersFromSQL } from '@/utils/sql';
import { useRouter } from 'next/router';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function useRunSQL(
  sqlCode: string,
  track: boolean,
  cascade: boolean,
  readOnly: boolean,
  isMigration: boolean,
  migrationName: string,
) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();

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

  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'hasura',
  );

  const adminSecret =
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? getHasuraAdminSecret()
      : currentProject?.config?.hasura.adminSecret;

  const toastStyle = getToastStyleProps();

  const createMigration = async (
    inputSQL: string,
    migration: string,
    isCascade: boolean,
  ) => {
    try {
      const migrationApiResponse = await fetch(`${appUrl}/apis/migrate`, {
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
        throw new Error('Migration API call failed');
      }

      return {
        error: null,
      };
    } catch (createMigrationError) {
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
    } catch (error) {
      return {
        result_type: 'error',
        columns: [],
        rows: [],
        error: error.message || 'Unknown error',
      };
    }
  };

  const trackAll = async (objects: any[]): Promise<Response[]> => {
    const apiPath = isPlatform ? '/v1/metadata' : '/apis/migrate';
    const responses: Response[] = await Promise.all(
      objects.map((object) =>
        fetch(`${appUrl}${apiPath}`, {
          method: 'POST',
          headers: { 'x-hasura-admin-secret': adminSecret },
          body: JSON.stringify(object),
        }).then((response) => {
          if (!response.ok) {
            console.error('failed to track:', response);
          }
          return response;
        }),
      ),
    ).catch((error) => {
      console.error('Error in trackAll:', error);
      throw error;
    });

    return responses;
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

    let trackTablesOrViews: any[] = [];
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
    } catch (error) {
      toast.error('An error happened when calling the metadata API', {
        style: toastStyle.style,
        ...toastStyle.error,
      });
    }
  };

  const runSQL = async () => {
    setLoading(true);
    setCommandOk(false);
    setErrorMessage('');

    if (isMigration) {
      const { error: createMigrationError } = await createMigration(
        sqlCode,
        migrationName,
        cascade,
      );

      setCommandOk(!createMigrationError);

      if (createMigrationError) {
        setErrorMessage('An unknown error occurred');
      }

      // if running the migration fails then we don't update the metadata
      if (track && !createMigrationError) {
        await updateMetadata(sqlCode);
      }
    } else {
      const {
        result_type,
        error: $error,
        columns: $columns,
        rows: $rows,
      } = await sendSQLToHasura(sqlCode, cascade, readOnly);

      setCommandOk(result_type === 'CommandOk');
      setColumns($columns);
      setRows($rows);
      setErrorMessage($error);

      // if running the sql fails then we don't update the metadata
      if (track && !$error) {
        await updateMetadata(sqlCode);
      }
    }

    // refresh the table list after running the sql
    await refetch();

    setLoading(false);
  };

  return {
    runSQL,
    loading,
    errorMessage,
    commandOk,
    rows,
    columns,
  };
}
