/** biome-ignore-all lint/suspicious/noArrayIndexKey: used with value*/

import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { InfoIcon, PlayIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useResizable } from 'react-resizable-layout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Switch } from '@/components/ui/v2/Switch';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Pagination } from '@/components/common/Pagination';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunSQL } from '@/features/orgs/projects/database/dataGrid/hooks/useRunSQL';
import {
  PAGE_SIZE_OPTIONS,
  useSQLEditorPagination,
} from '@/features/orgs/projects/database/dataGrid/hooks/useSqlEditorPagination';

interface SQLEditorProps {
  initialSQL?: string;
}

export default function SQLEditor({ initialSQL }: SQLEditorProps) {
  const theme = useTheme();
  const isPlatform = useIsPlatform();

  const [sqlCode, setSQLCode] = useState(initialSQL ?? '');
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

  const {
    currentPage,
    limit,
    totalNrOfPages,
    paginatedRows,
    setCurrentPage,
    setLimitAndReset: _setLimitAndReset,
    handleLimitChange,
    goPrev,
    goNext,
    hasNoPreviousPage,
    hasNoNextPage,
  } = useSQLEditorPagination({ rows, resetKey: sqlCode });

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
                <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
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
                <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
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
                <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
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
                      className="h-4 w-4 text-primary"
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
            startIcon={<PlayIcon className="h-4 w-4" />}
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
        sx={{ background: theme.palette.background.default }}
        {...separatorProps}
      />

      <Box
        className="flex flex-col overflow-auto"
        style={{ height: position }}
      >
        {loading && (
          <Box className="flex flex-1 items-center justify-center p-4">
            <ActivityIndicator
              circularProgressProps={{ className: 'w-5 h-5' }}
            />
          </Box>
        )}

        {errorMessage && (
          <Box className="flex flex-1 items-center justify-center p-4">
            <Alert
              severity="error"
              className="grid grid-flow-row place-content-center gap-2"
            >
              <code>{errorMessage}</code>
            </Alert>
          </Box>
        )}

        {!loading && !errorMessage && commandOk && rows.length === 0 && (
          <Box className="flex flex-1 items-center justify-center p-4">
            <Alert
              severity="success"
              className="grid grid-flow-row place-content-center gap-2"
            >
              <code>Success, no rows returned</code>
            </Alert>
          </Box>
        )}

        {!loading && !errorMessage && rows.length > 0 && (
          <Box className="flex flex-1 flex-col overflow-hidden">
            <Box className="flex-1 overflow-auto p-4">
              <Table style={{ tableLayout: 'auto' }} className="w-auto">
                <TableHead
                  sx={{ background: theme.palette.background.default }}
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
                  {paginatedRows.map((row, rowIndex) => (
                    <TableRow key={String(rowIndex)}>
                      {row.map((value, valueIndex) => (
                        <TableCell
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
            </Box>

            <Box className="flex shrink-0 items-center justify-between border-t px-4 py-1">
              <Box className="flex items-center gap-2">
                <Text
                  variant="subtitle2"
                  className="whitespace-nowrap text-xs"
                  color="secondary"
                >
                  Rows per page
                </Text>
                <Select
                  value={limit}
                  onChange={handleLimitChange}
                  slotProps={{
                    root: { className: 'h-5 min-w-[60px] text-xs' },
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <Option key={size} value={size}>
                      {size}
                    </Option>
                  ))}
                </Select>
              </Box>

              <Pagination
                totalNrOfPages={totalNrOfPages}
                currentPageNumber={currentPage}
                elementsPerPage={limit}
                totalNrOfElements={rows.length}
                itemsLabel="rows"
                onPrevPageClick={goPrev}
                onNextPageClick={goNext}
                onPageChange={setCurrentPage}
                slotProps={{
                  prevButton: { disabled: hasNoPreviousPage },
                  nextButton: { disabled: hasNoNextPage },
                }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}