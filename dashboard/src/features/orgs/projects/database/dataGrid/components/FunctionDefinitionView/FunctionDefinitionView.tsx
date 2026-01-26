import { useRouter } from 'next/router';
import { useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useFunctionPreviewHook } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionPreview';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';

export interface FunctionDefinitionViewProps {
  /**
   * Schema where the function is located. Falls back to router query if not provided.
   */
  schema?: string;
  /**
   * Function name. Falls back to router query if not provided.
   */
  functionName?: string;
  /**
   * Data source. Falls back to router query if not provided.
   */
  dataSource?: string;
}

export default function FunctionDefinitionView({
  schema: schemaProp,
  functionName: functionNameProp,
  dataSource: dataSourceProp,
}: FunctionDefinitionViewProps = {}) {
  const router = useRouter();
  const {
    query: { schemaSlug, functionSlug, dataSourceSlug },
  } = router;

  // Use props if provided, otherwise fall back to router query
  const schema = schemaProp || (schemaSlug as string);
  const functionName = functionNameProp || (functionSlug as string);
  const dataSource = dataSourceProp || (dataSourceSlug as string) || 'default';

  const currentTablePath =
    dataSource && schema && functionName
      ? `${dataSource}.${schema}.${functionName}`
      : '';
  const [showPreview, setShowPreview] = useState(false);
  const [parameterValues, setParameterValues] = useState<
    Record<number, string>
  >({});

  const {
    runPreview,
    loading: previewLoading,
    result: previewResult,
  } = useFunctionPreviewHook();

  const { data, status, error } = useFunctionQuery(
    ['function-definition', currentTablePath],
    {
      table: functionName,
      schema,
      dataSource,
      queryOptions: {
        enabled: !!currentTablePath && !!functionName,
      },
    },
  );

  const { functionMetadata, error: functionError } = data || {
    functionMetadata: null,
    error: null,
  };

  function handlePreview() {
    if (!schema || !functionName || !functionMetadata) {
      return;
    }

    // Build parameters array from form values
    const requiredParamsCount =
      functionMetadata.parameters.length - functionMetadata.defaultArgsCount;
    const params: (string | number | null)[] = functionMetadata.parameters
      .slice(0, requiredParamsCount)
      .map((param, index) => {
        const value = parameterValues[index];
        if (!value || value.trim() === '') {
          return null;
        }
        // Try to parse as number if the type suggests it
        if (
          param.type === 'numeric' ||
          param.type === 'integer' ||
          param.type === 'bigint' ||
          param.type === 'smallint' ||
          param.type === 'real' ||
          param.type === 'double precision'
        ) {
          const numValue = Number(value);
          return Number.isNaN(numValue) ? value : numValue;
        }
        return value;
      });

    setShowPreview(true);
    runPreview({
      schema,
      functionName,
      dataSource,
      limit: 20,
      parameters: params,
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
            Function{' '}
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {schema}.{functionName}
            </InlineCode>{' '}
            does not exist or is not a table-returning function.
          </span>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b p-4">
        <div className="mb-4">
          <h2 className="font-semibold text-lg">Function Definition</h2>
          <p className="text-muted-foreground text-sm">
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {schema}.{functionName}
            </InlineCode>
          </p>
        </div>
        {functionMetadata && (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="mb-3">
              <h3 className="font-semibold text-base">
                {functionMetadata.functionName}
              </h3>
              <p className="text-muted-foreground text-sm">
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
                · Returns{' '}
                {functionMetadata.returnsSet ? (
                  <>
                    SETOF{' '}
                    <InlineCode className="bg-opacity-80 px-1 text-xs">
                      {functionMetadata.returnTypeName}
                    </InlineCode>
                  </>
                ) : (
                  <InlineCode className="bg-opacity-80 px-1 text-xs">
                    {functionMetadata.returnTypeName}
                  </InlineCode>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {functionMetadata.functionType && (
                <Badge variant="outline" className="font-medium">
                  {functionMetadata.functionType}
                </Badge>
              )}
              {functionMetadata.returnsSet && (
                <Badge variant="outline" className="font-medium">
                  SETOF {functionMetadata.returnTypeName}
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
        )}
        {functionMetadata &&
          functionMetadata.parameters.length > 0 &&
          functionMetadata.parameters.length >
            functionMetadata.defaultArgsCount && (
            <div className="mt-4 rounded-md border bg-muted/20 p-4">
              <h4 className="mb-3 font-medium text-sm">Function Parameters</h4>
              <div className="space-y-3">
                {functionMetadata.parameters
                  .slice(
                    0,
                    functionMetadata.parameters.length -
                      functionMetadata.defaultArgsCount,
                  )
                  .map((param, index) => (
                    <div
                      key={`param-${param.name || index}-${index}`}
                      className="flex items-center gap-3"
                    >
                      <label
                        htmlFor={`param-${index}`}
                        className="w-32 font-medium text-sm"
                      >
                        {param.name || `Parameter ${index + 1}`}
                      </label>
                      <div className="flex-1">
                        <Input
                          id={`param-${index}`}
                          type="text"
                          placeholder={`${param.type}${param.schema ? ` (${param.schema})` : ''}`}
                          value={parameterValues[index] || ''}
                          onChange={(e) =>
                            setParameterValues({
                              ...parameterValues,
                              [index]: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handlePreview();
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={handlePreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Running...
                    </>
                  ) : (
                    'Execute'
                  )}
                </Button>
              </div>
            </div>
          )}
      </div>
      {showPreview && previewResult && (
        <div className="border-b bg-muted/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">
                Execution results (not persisted)
              </h3>
              <p className="text-muted-foreground text-xs">
                Results depend on input parameters and current database state
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(false)}
            >
              Close
            </Button>
          </div>
          {previewResult.error ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
              {previewResult.error}
            </div>
          ) : previewResult.rows.length === 0 ? (
            <div className="rounded-md border p-3 text-muted-foreground text-sm">
              No results returned
            </div>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border bg-background">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {previewResult.columns.map((column) => (
                      <th
                        key={column}
                        // biome-ignore lint: CSS class order needs specific ordering
                        className="border-b border-r px-4 py-2 text-left font-semibold text-xs last:border-r-0"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewResult.rows.map((row, rowIndex) => {
                    const rowKey = `row-${rowIndex}-${row.join('-').substring(0, 20)}`;
                    return (
                      <tr key={rowKey} className="hover:bg-muted/50">
                        {row.map((cell, cellIndex) => {
                          const cellKey = `${rowKey}-cell-${previewResult.columns[cellIndex]}`;
                          return (
                            <td
                              key={cellKey}
                              // biome-ignore lint: CSS class order needs specific ordering
                              className="border-b border-r px-4 py-2 text-xs last:border-r-0"
                              title={cell.length > 50 ? cell : undefined}
                            >
                              <div className="max-w-xs truncate">
                                {cell || (
                                  <span className="text-muted-foreground">
                                    null
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
