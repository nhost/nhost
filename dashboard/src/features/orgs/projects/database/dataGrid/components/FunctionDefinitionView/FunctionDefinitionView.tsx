import { Play } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { TrackFunctionButton } from '@/features/orgs/projects/database/dataGrid/components/TrackFunctionButton';
import { useFunctionPreviewHook } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionPreview';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';

export default function FunctionDefinitionView() {
  const router = useRouter();
  const {
    query: { schemaSlug, functionOID: routerFunctionOID, dataSourceSlug },
  } = router;

  const schema = schemaSlug as string;
  const dataSource = (dataSourceSlug as string) || 'default';
  const functionOID = (routerFunctionOID as string) || '';

  const cacheKey =
    dataSource && functionOID ? `${dataSource}.${functionOID}` : '';

  const { data, status, error } = useFunctionQuery(
    ['function-definition', cacheKey],
    {
      functionOID,
      dataSource,
      queryOptions: {
        enabled: !!cacheKey && !!functionOID,
      },
    },
  );

  const { functionMetadata, error: functionError } = data || {
    functionMetadata: null,
    error: null,
  };

  const functionName = functionMetadata?.functionName;

  const parameters = functionMetadata?.parameters ?? [];
  const defaultArgsCount = functionMetadata?.defaultArgsCount ?? 0;
  const requiredParamsCount = parameters.length - defaultArgsCount;

  const [paramValues, setParamValues] = useState<string[]>([]);
  const {
    runPreview,
    loading: previewLoading,
    result: previewResult,
  } = useFunctionPreviewHook();

  function handleParamChange(index: number, value: string) {
    setParamValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleExecute() {
    if (!functionName) {
      return;
    }

    const args = parameters.map((_, index) => {
      const value = paramValues[index];
      if (value === undefined || value === '') {
        return null;
      }
      return value;
    });

    await runPreview({
      schema,
      functionName,
      dataSource,
      parameters: args,
    });
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner
          wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
          className="h-4 w-4 justify-center"
        >
          Loading function definition...
        </Spinner>
      </div>
    );
  }

  if (status === 'error' || functionError) {
    return (
      <DataBrowserEmptyState
        title="Error loading function"
        description={
          <span>
            {error instanceof Error
              ? error.message
              : functionError ||
                'Unknown error occurred. Please try again later.'}
          </span>
        }
      />
    );
  }

  if (!functionMetadata) {
    return (
      <DataBrowserEmptyState
        title="Function not found"
        description={
          <span>
            The function does not exist or is not a table-returning function.
          </span>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b p-4">
        <div className="mb-4">
          <TrackFunctionButton
            schema={schema}
            functionName={functionMetadata.functionName}
            returnTableName={functionMetadata.returnTableName}
            returnTableSchema={functionMetadata.returnTableSchema}
          />
          <h2 className="font-semibold text-lg">Function Definition</h2>
          <p className="text-muted-foreground text-sm">
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {schema}.{functionName}
            </InlineCode>
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="mb-3">
            <h3 className="font-semibold text-base">
              {functionMetadata.functionName}
            </h3>
            {functionMetadata.comment && (
              <p className="mt-1 text-muted-foreground text-sm">
                {functionMetadata.comment}
              </p>
            )}
            <p className="mt-1 text-muted-foreground text-sm">
              {functionMetadata.language === 'sql'
                ? 'SQL function'
                : `${functionMetadata.language.toUpperCase()} function`}{' '}
              {functionMetadata.functionType && (
                <>
                  ·{' '}
                  <span className="font-medium">
                    {functionMetadata.functionType}
                  </span>
                </>
              )}{' '}
              · Returns SETOF{' '}
              <InlineCode className="bg-opacity-80 px-1 text-xs">
                {functionMetadata.returnTableName
                  ? `${functionMetadata.returnTableSchema}.${functionMetadata.returnTableName}`
                  : functionMetadata.returnTypeName}
              </InlineCode>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {functionMetadata.functionType && (
              <Badge variant="outline" className="font-medium">
                {functionMetadata.functionType}
              </Badge>
            )}
            <Badge variant="outline" className="font-medium">
              SETOF {functionMetadata.returnTypeName}
            </Badge>
            {functionMetadata.returnTableName && (
              <Badge variant="outline" className="font-medium">
                Returns table: {functionMetadata.returnTableSchema}.
                {functionMetadata.returnTableName}
              </Badge>
            )}
            {functionMetadata.functionType === 'STABLE' ||
            functionMetadata.functionType === 'IMMUTABLE' ? (
              <Badge variant="outline" className="font-medium">
                Query-only
              </Badge>
            ) : null}
          </div>
        </div>
        {parameters.length > 0 && (
          <div className="mt-4 rounded-md border bg-muted/20 p-4">
            <h4 className="mb-3 font-medium text-sm">Parameters</h4>
            <div className="space-y-2">
              {parameters.map((param, index) => (
                <div
                  key={`param-${param.name || index}-${index}`}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-32 font-medium">
                    {param.name || `arg${index + 1}`}
                  </span>
                  <Input
                    className="h-8 w-48 text-sm"
                    placeholder={param.displayType}
                    value={paramValues[index] ?? ''}
                    onChange={(e) => handleParamChange(index, e.target.value)}
                  />
                  <InlineCode className="bg-opacity-80 px-1.5 text-xs">
                    {param.displayType}
                  </InlineCode>
                  {index >= requiredParamsCount && (
                    <span className="text-muted-foreground text-xs italic">
                      optional
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={previewLoading}
          >
            <Play className="h-4 w-4" />
            {previewLoading ? 'Executing...' : 'Execute'}
          </Button>
        </div>
      </div>
      {previewResult?.error && (
        <div className="border-b px-4 py-3">
          <p className="text-destructive text-sm">{previewResult.error}</p>
        </div>
      )}
      {previewResult && !previewResult.error && (
        <div className="min-h-0 flex-1 overflow-auto">
          {previewResult.rows.length === 0 ? (
            <p className="px-4 py-3 text-muted-foreground text-sm">
              No rows returned.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr>
                  {previewResult.columns.map((col) => (
                    <th
                      key={col}
                      className="border-b px-3 py-2 text-left font-medium text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewResult.rows.map((row, rowIndex) => (
                  <tr
                    key={`row-${rowIndex}`}
                    className="border-b last:border-b-0"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        className="px-3 py-1.5"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
