/** biome-ignore-all lint/suspicious/noArrayIndexKey: used with value*/

import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror, { keymap, Prec } from '@uiw/react-codemirror';
import { InfoIcon, PlayIcon, XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useResizable } from 'react-resizable-layout';
import { Pagination } from '@/components/common/Pagination';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { Switch } from '@/components/ui/v3/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunSQL } from '@/features/orgs/projects/database/dataGrid/hooks/useRunSQL';
import {
  PAGE_SIZE_OPTIONS,
  useSQLEditorPagination,
} from '@/features/orgs/projects/database/dataGrid/hooks/useSQLEditorPagination';

function InfoTooltip({ title }: { title: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Info" className="cursor-help">
          <InfoIcon className="h-4 w-4 text-primary" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

interface SQLEditorProps {
  initialSQL?: string;
  /**
   * When true, the results panel (and its resize handle) stays hidden until a
   * query is running or has produced a result. Lets embedders in a constrained
   * container give the editor the full height while there is nothing to show.
   */
  hideEmptyResults?: boolean;
}

export default function SQLEditor({
  initialSQL,
  hideEmptyResults = false,
}: SQLEditorProps) {
  const theme = useTheme();
  const isPlatform = useIsPlatform();

  const [sqlCode, setSQLCode] = useState(initialSQL ?? '');
  const [track, setTrack] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [isMigration, setIsMigration] = useState(false);
  const [migrationName, setMigrationName] = useState('');

  const { runSQL, reset, loading, errorMessage, commandOk, rows, columns } =
    useRunSQL(sqlCode, track, cascade, readOnly, isMigration, migrationName);

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
    handleLimitChange,
    goPrev,
    goNext,
  } = useSQLEditorPagination({ rows });

  const hasResult =
    loading || Boolean(errorMessage) || commandOk || columns.length > 0;
  const showResults = !hideEmptyResults || hasResult;

  const canDismissResults =
    hideEmptyResults &&
    !loading &&
    (Boolean(errorMessage) || commandOk || columns.length > 0);

  const isRunDisabled = loading || !sqlCode.trim();

  const onChange = useCallback(
    (value: string) => {
      setSQLCode(value);
      if (canDismissResults) {
        reset();
      }
    },
    [canDismissResults, reset],
  );

  const handleRunSQL = useCallback(() => {
    if (isRunDisabled) {
      return;
    }

    runSQL();
  }, [isRunDisabled, runSQL]);

  return (
    <div className="flex flex-1 flex-col justify-center overflow-hidden">
      <div className="flex flex-col space-y-2 border-b p-4">
        <p className="font-semibold">Raw SQL</p>
        <div className="flex flex-col justify-between space-y-2 lg:flex-row lg:space-x-4 lg:space-y-0">
          <div className="flex w-full flex-col space-y-2 lg:flex-row lg:space-x-4 lg:space-y-0 xl:h-10">
            <div className="flex items-center gap-2">
              <Switch id="track" checked={track} onCheckedChange={setTrack} />
              <Label htmlFor="track" className="font-normal">
                Track this
              </Label>
              <InfoTooltip title="If you are creating tables, views or functions, checking this will also expose them over the GraphQL API as top level fields. Functions only intended to be used as computed fields should not be tracked." />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="cascade"
                checked={cascade}
                onCheckedChange={setCascade}
              />
              <Label htmlFor="cascade" className="font-normal">
                Cascade metadata
              </Label>
              <InfoTooltip title="Cascade actions on all dependent metadata references, like relationships and permissions" />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="readOnly"
                checked={readOnly}
                onCheckedChange={setReadOnly}
              />
              <Label htmlFor="readOnly" className="font-normal">
                Read only
              </Label>
              <InfoTooltip title="When set to true, the request will be run in READ ONLY transaction access mode which means only select queries will be successful. This flag ensures that the GraphQL schema is not modified and is hence highly performant." />
            </div>

            {!isPlatform && (
              <div className="flex flex-col space-x-0 space-y-2 xl:flex-row xl:space-x-4 xl:space-y-0">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isMigration"
                    checked={isMigration}
                    onCheckedChange={setIsMigration}
                  />
                  <Label htmlFor="isMigration" className="font-normal">
                    This is a migration
                  </Label>
                  <InfoTooltip title="Create a migration file with the SQL statement" />
                </div>

                {isMigration && (
                  <Input
                    name="migrationName"
                    id="migrationName"
                    placeholder="migration_name"
                    className="h-auto w-auto max-w-md"
                    onChange={(e) => setMigrationName(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="self-start">
                <Button disabled={isRunDisabled} onClick={handleRunSQL}>
                  <PlayIcon className="mr-2 h-4 w-4" />
                  Run
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Run query (⌘/Ctrl + Enter)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <CodeMirror
        value={sqlCode}
        height="100%"
        className="min-h-[100px] flex-1 overflow-y-auto"
        theme={theme.palette.mode === 'light' ? githubLight : githubDark}
        extensions={[
          sql({ dialect: PostgreSQL }),
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  handleRunSQL();
                  return true;
                },
              },
            ]),
          ),
        ]}
        onChange={onChange}
      />

      {showResults && (
        <>
          <div
            className="h-2 border-t bg-background hover:cursor-row-resize"
            {...separatorProps}
          />

          <div
            className="flex flex-col overflow-auto"
            style={{ height: position }}
          >
            {canDismissResults && (
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-1">
                <span className="text-muted-foreground text-xs">Result</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close results"
                  onClick={reset}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            )}

            {loading && (
              <div className="flex flex-1 items-center justify-center p-4">
                <Spinner className="h-5 w-5" />
              </div>
            )}

            {errorMessage && (
              <div className="flex flex-1 items-center justify-center p-4">
                <Alert
                  variant="destructive"
                  className="grid grid-flow-row place-content-center gap-2"
                >
                  <code>{errorMessage}</code>
                </Alert>
              </div>
            )}

            {!loading && !errorMessage && commandOk && rows.length === 0 && (
              <div className="flex flex-1 items-center justify-center p-4">
                <Alert className="grid grid-flow-row place-content-center gap-2 border-green-600/50 text-green-600 dark:border-green-500/50 dark:text-green-500">
                  <code>Success, no rows returned</code>
                </Alert>
              </div>
            )}

            {!loading && !errorMessage && columns.length > 0 && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-4">
                  <Table style={{ tableLayout: 'auto' }} className="w-auto">
                    <TableHeader className="bg-background">
                      <TableRow>
                        {columns.map((header) => (
                          <TableHead
                            key={header}
                            scope="col"
                            className="whitespace-nowrap border px-6 py-3 font-bold text-foreground"
                          >
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

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
                </div>

                {rows.length > 0 && (
                  <div className="flex shrink-0 items-center justify-between border-t px-4 py-1">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-muted-foreground text-xs">
                        Rows per page
                      </span>
                      <Select
                        value={String(limit)}
                        onValueChange={(value) =>
                          handleLimitChange(null, Number(value))
                        }
                      >
                        <SelectTrigger
                          aria-label="Rows per page"
                          className="h-7 min-w-[60px] px-2 text-xs"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Pagination
                      totalNrOfPages={totalNrOfPages}
                      currentPageNumber={currentPage}
                      elementsPerPage={limit}
                      totalNrOfElements={rows.length}
                      itemsLabel="rows"
                      onPrevPageClick={goPrev}
                      onNextPageClick={goNext}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
