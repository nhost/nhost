import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlayIcon } from '@/components/ui/v2/icons/PlayIcon';
import { Switch } from '@/components/ui/v2/Switch';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
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

  const [loading, setLoading] = useState(false);
  const [sqlCode, setSQLCode] = useState('');

  const [track, setTrack] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const { currentProject } = useCurrentWorkspaceAndProject();

  const onChange = useCallback((value: string) => setSQLCode(value), []);

  // TODO convert to form
  // TODO inlude a tooltip for info about the checkboxes
  // TODO add this and figure out how to show the input to write the migration name

  // const isPlatform = useIsPlatform();
  // const [isMigration, setIsMigration] = useState(false);

  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([[]]);

  const [commandOk, setCommandOk] = useState(false);
  const [error, setError] = useState('');

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

  const sendSQLToHasura = async () => {
    setLoading(true);
    setCommandOk(false);
    setError('');

    const response: {
      result: string[][];
      result_type: string;
    } = await fetch(`${appUrl}/v2/query`, {
      method: 'POST',
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        args: {
          source: 'default',
          sql: sqlCode,
          cascade,
          read_only: readOnly,
        },
        type: 'run_sql',
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json();
          setError(e?.internal?.error?.message);
          return null;
        }
        return res.json();
      })
      .catch(() => {
        // TODO figure out how to show network request errors
        // console.log({ error: err });
      })
      .finally(() => setLoading(false));

    const entities = extractEntitiesFromSQL(sqlCode);

    if (track && entities.length > 0) {
      await fetch(`${appUrl}/v1/metadata`, {
        method: 'POST',
        headers: {
          'x-hasura-admin-secret': adminSecret,
        },
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
      });

      // TODO catch the errors for the metadataApiResponse
    }

    if (response?.result_type === 'TuplesOk') {
      setColumns(response.result.at(0));
      setRows(response.result.slice(1));
    }

    if (response?.result_type === 'CommandOk') {
      // Command ran successfully but no rows have been returned
      setColumns([]);
      setRows([]);
      setCommandOk(true);
    }
  };

  return (
    <Box className="flex flex-1 flex-col justify-center overflow-hidden">
      <Box className="flex flex-col space-y-2 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <Text className="font-semibold">Raw SQL</Text>
        <Box className="flex flex-col justify-between space-y-2 lg:flex-row lg:space-y-0 lg:space-x-4">
          <Box className="flex flex-col space-y-2 md:flex-row md:space-x-4 md:space-y-0">
            {/* TODO a toggle for the migration piece and add an input to hold the name */}
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
          </Box>
          <Button
            disabled={loading}
            variant="contained"
            className="self-start"
            startIcon={<PlayIcon />}
            onClick={sendSQLToHasura}
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
        {error && (
          <Alert
            severity="error"
            className="mx-auto grid grid-flow-row place-content-center gap-2 self-center"
          >
            <code>{error}</code>
          </Alert>
        )}

        {!loading && !error && commandOk && (
          <Alert
            severity="success"
            className="mx-auto grid grid-flow-row place-content-center gap-2 self-center"
          >
            <code>Success, no rows returned</code>
          </Alert>
        )}
        {!loading && !error && (
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
