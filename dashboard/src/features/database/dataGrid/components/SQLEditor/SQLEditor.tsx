import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlayIcon } from '@/components/ui/v2/icons/PlayIcon';
import { Input } from '@/components/ui/v2/Input';
import { Switch } from '@/components/ui/v2/Switch';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { extractEntitiesFromSQL } from '@/utils/helpers';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useState } from 'react';
import { useResizable } from 'react-resizable-layout';

export default function SQLEditor() {
  const theme = useTheme();
  const isPlatform = useIsPlatform();

  const [loading, setLoading] = useState(false);

  const [sqlCode, setSQLCode] = useState('');
  const [track, setTrack] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [isMigration, setIsMigration] = useState(false);
  const [migrationName, setMigrationName] = useState('');

  const { currentProject } = useCurrentWorkspaceAndProject();

  const onChange = useCallback((value: string) => setSQLCode(value), []);

  // TODO convert to form
  // TODO inlude a tooltip for info about the checkboxes
  // TODO add this and figure out how to show the input to write the migration name
  // TODO maybe reftech the tables after running a sql query against Hasura

  const [commandOk, setCommandOk] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([[]]);

  const { position, separatorProps } = useResizable({
    axis: 'y',
    initial: 400,
    min: 50,
    reverse: true,
  });

  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'hasura',
  );

  const adminSecret =
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? getHasuraAdminSecret()
      : currentProject?.config?.hasura.adminSecret;

  const sendSQLToHasura = async (
    inputSQL: string,
    isCascade: boolean,
    IsReadOnly: boolean,
  ) => {
    let queryApiError: string = '';
    let $columns: string[];
    let $rows: string[][];

    try {
      const response: {
        result: string[][];
        result_type: string;
      } = await fetch(`${appUrl}/v2/query`, {
        method: 'POST',
        headers: { 'x-hasura-admin-secret': adminSecret },
        body: JSON.stringify({
          type: 'run_sql',
          args: {
            source: 'default',
            sql: inputSQL,
            cascade: isCascade,
            read_only: IsReadOnly,
          },
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const e = await res.json();
          queryApiError = e?.internal?.error?.message;
          return null;
        }

        return res.json();
      });

      if (response?.result_type === 'TuplesOk') {
        $columns = response.result.at(0);
        $rows = response.result.slice(1);
      }

      if (response?.result_type === 'CommandOk') {
        // Command ran successfully but no rows have been returned
        $columns = [];
        $rows = [];
      }

      return {
        result_type: response?.result_type,
        error: queryApiError,
        columns: $columns,
        rows: $rows,
      };
    } catch (err) {
      // TODO figure out how to show network request errors
      console.error({ sendSQLToHasuraError: err });

      return {
        result_type: 'error',
        cols: [],
        rows: [],
        queryApiError: err.message,
      };
    }
  };

  const updateMetadata = async (inputSQL: string) => {
    const entities = extractEntitiesFromSQL(inputSQL);

    // TODO add proper typing to this
    let metadataApiResponse: any;

    if (entities.length > 0) {
      try {
        metadataApiResponse = await fetch(`${appUrl}/v1/metadata`, {
          method: 'POST',
          headers: { 'x-hasura-admin-secret': adminSecret },
          body: JSON.stringify({
            type: 'pg_track_tables',
            args: {
              tables: entities.map((entity) => ({
                source: 'default',
                table: entity.name,
                schema: entity.schema,
              })),
            },
          }),
        }).then((res) => res.json());
      } catch (metadataApiError) {
        // TODO handle this
        console.log(metadataApiError);
      }

      // TODO catch the errors for the metadataApiResponse
      console.log({
        metadataApiResponse,
      });
    }
  };

  const createMigration = async (
    inputSQL: string,
    migration: string,
    isCascade: boolean,
  ) => {
    // TODO add proper typing to this
    let migrationApiResponse: { name: string };

    try {
      migrationApiResponse = await fetch(`${appUrl}/apis/migrate`, {
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
      }).then((res) => res.json());
    } catch (createMigrationError) {
      // TODO typing
      console.log({ createMigrationError });
    }

    console.log({ migrationApiResponse });
  };

  const runSQL = async () => {
    setLoading(true);
    setCommandOk(false);
    setErrorMessage('');

    if (isMigration) {
      await createMigration(sqlCode, migrationName, cascade);
      if (track) {
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

      // If running the sql against Hasura fails then we should not update the metadata
      // it will also fail because none of the tables were created
      if (track && !$error) {
        await updateMetadata(sqlCode);
      }
    }

    // Figure out if the loading indicator should at the end of which network request
    setLoading(false);
  };

  return (
    <Box className="flex flex-1 flex-col justify-center overflow-hidden">
      <Box className="flex flex-col space-y-2 border-b p-4">
        <Text className="font-semibold">Raw SQL</Text>
        <Box className="flex flex-col justify-between space-y-2 lg:flex-row lg:space-y-0 lg:space-x-4">
          <Box className="flex w-full flex-col space-y-2 lg:flex-row lg:space-x-4 lg:space-y-0 xl:h-10">
            <Switch
              label={
                <Text variant="subtitle1" component="span">
                  Track this
                </Text>
              }
              checked={track}
              onChange={(event) => setTrack(event.currentTarget.checked)}
            />
            <Switch
              label={
                <Text variant="subtitle1" component="span">
                  Cascade metadata
                </Text>
              }
              checked={cascade}
              onChange={(e) => setCascade(e.target.checked)}
            />
            <Switch
              label={
                <Text variant="subtitle1" component="span">
                  Read only
                </Text>
              }
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
            {!isPlatform && (
              <Box className="flex flex-col space-x-0 space-y-2 xl:flex-row xl:space-x-4 xl:space-y-0">
                <Switch
                  label={
                    <Text variant="subtitle1" component="span">
                      This is a migration
                    </Text>
                  }
                  checked={isMigration}
                  onChange={(e) => setIsMigration(e.target.checked)}
                />
                {isMigration && (
                  <Input
                    name="isMigration"
                    id="isMigration"
                    placeholder="migration_name"
                    className="h-auto w-auto max-w-md"
                    fullWidth
                    hideEmptyHelperText
                    onChange={(e) => setMigrationName(e.target.value)}
                  />
                )}
              </Box>
            )}
          </Box>
          <Button
            disabled={loading}
            variant="contained"
            className="self-start"
            startIcon={<PlayIcon />}
            onClick={runSQL}
          >
            Run
          </Button>
        </Box>
      </Box>

      <CodeMirror
        value={sqlCode}
        height="100%"
        className="flex-grow"
        theme={theme.palette.mode === 'light' ? githubLight : githubDark}
        extensions={[sql({ dialect: PostgreSQL })]}
        onChange={onChange}
      />

      <Box
        className="h-2 border-t hover:cursor-row-resize"
        sx={{
          background: theme.palette.background.default,
        }}
        {...separatorProps}
      />

      <Box
        className="flex items-start overflow-auto p-4"
        style={{ height: position }}
      >
        {loading && (
          <ActivityIndicator
            className="mx-auto self-center"
            circularProgressProps={{
              className: 'w-5 h-5',
            }}
          />
        )}

        {errorMessage && (
          <Alert
            severity="error"
            className="mx-auto grid grid-flow-row place-content-center gap-2 self-center"
          >
            <code>{errorMessage}</code>
          </Alert>
        )}

        {!loading && !errorMessage && commandOk && (
          <Alert
            severity="success"
            className="mx-auto grid grid-flow-row place-content-center gap-2 self-center"
          >
            <code>Success, no rows returned</code>
          </Alert>
        )}

        {!loading && !errorMessage && (
          <Table
            style={{
              tableLayout: 'auto',
            }}
            className="w-auto"
          >
            <TableHead
              sx={{
                background: theme.palette.background.default,
              }}
            >
              <TableRow>
                {columns.map((header) => (
                  <TableCell
                    key={header}
                    scope="col"
                    className="whitespace-nowrap border px-6 py-3 font-bold"
                  >
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow
                  // eslint-disable-next-line react/no-array-index-key
                  key={String(rowIndex)}
                  // className="px-6 py-4 border whitespace-nowrap"
                >
                  {row.map((value, valueIndex) => (
                    <TableCell
                      // eslint-disable-next-line react/no-array-index-key
                      key={`${value}-${valueIndex}`}
                      className="whitespace-nowrap border px-6 py-4"
                    >
                      {value}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
