import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlayIcon } from '@/components/ui/v2/icons/PlayIcon';
import { Input } from '@/components/ui/v2/Input';
import { Switch } from '@/components/ui/v2/Switch';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useRunSQL } from '@/features/database/dataGrid/hooks/useRunSQL';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useState } from 'react';
import { useResizable } from 'react-resizable-layout';

export default function SQLEditor() {
  const theme = useTheme();
  const isPlatform = useIsPlatform();

  const [sqlCode, setSQLCode] = useState('');
  const [track, setTrack] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [isMigration, setIsMigration] = useState(false);
  const [migrationName, setMigrationName] = useState('');

  const onChange = useCallback((value: string) => setSQLCode(value), []);

  const { runSQL, loading, errorMessage, commandOk, rows, columns } = useRunSQL(
    sqlCode,
    track,
    cascade,
    readOnly,
    isMigration,
    migrationName,
  );

  const { position, separatorProps } = useResizable({
    axis: 'y',
    initial: 400,
    min: 50,
    reverse: true,
  });

  return (
    <Box className="flex flex-1 flex-col justify-center overflow-hidden">
      <Box className="flex flex-col space-y-2 border-b p-4">
        <Text className="font-semibold">Raw SQL</Text>
        <Box className="flex flex-col justify-between space-y-2 lg:flex-row lg:space-x-4 lg:space-y-0">
          <Box className="flex w-full flex-col space-y-2 lg:flex-row lg:space-x-4 lg:space-y-0 xl:h-10">
            <Box className="flex items-center space-x-2">
              <Switch
                label={
                  <Text variant="subtitle1" component="span">
                    Track this
                  </Text>
                }
                checked={track}
                onChange={(event) => setTrack(event.currentTarget.checked)}
              />
              <Tooltip title="If you are creating tables, views or functions, checking this will also expose them over the GraphQL API as top level fields. Functions only intended to be used as computed fields should not be tracked.">
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>

            <Box className="flex items-center space-x-2">
              <Switch
                label={
                  <Text variant="subtitle1" component="span">
                    Cascade metadata
                  </Text>
                }
                checked={cascade}
                onChange={(e) => setCascade(e.target.checked)}
              />

              <Tooltip title="Cascade actions on all dependent metadata references, like relationships and permissions">
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>

            <Box className="flex items-center space-x-2">
              <Switch
                label={
                  <Text variant="subtitle1" component="span">
                    Read only
                  </Text>
                }
                checked={readOnly}
                onChange={(e) => setReadOnly(e.target.checked)}
              />

              <Tooltip title="When set to true, the request will be run in READ ONLY transaction access mode which means only select queries will be successful. This flag ensures that the GraphQL schema is not modified and is hence highly performant.">
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>

            {!isPlatform && (
              <Box className="flex flex-col space-x-0 space-y-2 xl:flex-row xl:space-x-4 xl:space-y-0">
                <Box className="flex items-center space-x-2">
                  <Switch
                    label={
                      <Text variant="subtitle1" component="span">
                        This is a migration
                      </Text>
                    }
                    checked={isMigration}
                    onChange={(e) => setIsMigration(e.target.checked)}
                  />
                  <Tooltip title="Create a migration file with the SQL statement">
                    <InfoIcon
                      aria-label="Info"
                      className="h-4 w-4"
                      color="primary"
                    />
                  </Tooltip>
                </Box>

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
            disabled={loading || !sqlCode.trim()}
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
        className="min-h-[100px] flex-1 overflow-y-auto"
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
