import { useRouter } from 'next/router';
import { Badge } from '@/components/ui/v3/badge';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { TrackFunctionButton } from '@/features/orgs/projects/database/dataGrid/components/TrackFunctionButton';
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

  const requiredParamsCount =
    functionMetadata.parameters.length - functionMetadata.defaultArgsCount;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b p-4">
        <div className="mb-4">
          <TrackFunctionButton
            schema={schema}
            functionName={functionMetadata.functionName}
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
        {functionMetadata.parameters.length > 0 && (
          <div className="mt-4 rounded-md border bg-muted/20 p-4">
            <h4 className="mb-3 font-medium text-sm">Parameters</h4>
            <div className="space-y-2">
              {functionMetadata.parameters.map((param, index) => (
                <div
                  key={`param-${param.name || index}-${index}`}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-32 font-medium">
                    {param.name || `arg${index + 1}`}
                  </span>
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
      </div>
    </div>
  );
}
