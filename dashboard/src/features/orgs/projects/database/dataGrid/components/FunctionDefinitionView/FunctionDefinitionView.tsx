import { Play } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useFunctionPreviewHook } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionPreview';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';

export interface FunctionDefinitionViewProps {
  schema?: string;
  functionName?: string;
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

  const schema = schemaProp || (schemaSlug as string);
  const functionName = functionNameProp || (functionSlug as string);
  const dataSource = dataSourceProp || (dataSourceSlug as string) || 'default';

  const {
    data,
    status,
    error: queryError,
  } = useFunctionQuery(
    ['function-definition', dataSource, schema, functionName],
    {
      functionName,
      schema,
      dataSource,
      queryOptions: {
        enabled: !!schema && !!functionName,
      },
    },
  );

  const {
    functionDefinition,
    functionMetadata,
    error: functionError,
  } = data || {
    functionDefinition: '',
    functionMetadata: null,
    error: null,
  };

  const parameters = functionMetadata?.parameters ?? [];
  const defaultArgsCount = functionMetadata?.defaultArgsCount ?? 0;
  const requiredParamCount = parameters.length - defaultArgsCount;

  const [paramValues, setParamValues] = useState<string[]>([]);
  const { runPreview, loading: previewLoading, result: previewResult } =
    useFunctionPreviewHook();

  function handleParamChange(index: number, value: string) {
    setParamValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleExecute() {
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
            {queryError instanceof Error
              ? queryError.message
              : functionError ||
                'Unknown error occurred. Please try again later.'}
          </span>
        }
      />
    );
  }

  if (!functionDefinition) {
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
      <p className="border-b px-4 py-3 text-muted-foreground text-sm">
        <InlineCode className="bg-opacity-80 px-1.5 text-sm">
          {schema}.{functionName}
        </InlineCode>
        <span className="ml-1 text-xs">(FUNCTION)</span>
      </p>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <SQLEditor initialSQL={functionDefinition} />
        </div>
        <div className="border-t">
          <div className="flex flex-wrap items-end gap-2 px-4 py-3">
            {parameters.map((param, index) => (
              <div key={param.name || index} className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">
                  {param.name || `arg${index + 1}`}
                  <span className="ml-1 text-muted-foreground/60">
                    ({param.displayType})
                  </span>
                  {index >= requiredParamCount && (
                    <span className="ml-1 italic text-muted-foreground/40">
                      optional
                    </span>
                  )}
                </label>
                <Input
                  className="h-8 w-40 text-sm"
                  placeholder={param.displayType}
                  value={paramValues[index] ?? ''}
                  onChange={(e) => handleParamChange(index, e.target.value)}
                />
              </div>
            ))}
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={previewLoading}
            >
              <Play className="h-4 w-4" />
              {previewLoading ? 'Executing...' : 'Execute'}
            </Button>
          </div>
          {previewResult?.error && (
            <div className="border-t px-4 py-3">
              <p className="text-destructive text-sm">{previewResult.error}</p>
            </div>
          )}
          {previewResult && !previewResult.error && (
            <div className="max-h-64 overflow-auto border-t">
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
      </div>
    </div>
  );
}
