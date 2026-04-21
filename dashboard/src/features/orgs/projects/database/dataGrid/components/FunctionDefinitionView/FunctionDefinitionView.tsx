import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { ChevronDown, ChevronRight, Info, Pencil } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { TrackFunctionButton } from '@/features/orgs/projects/database/dataGrid/components/TrackFunctionButton';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useIsTrackedFunction } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedFunction';

const EditFunctionForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionForm/EditFunctionForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export default function FunctionDefinitionView() {
  const theme = useTheme();
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

  const {
    functionMetadata,
    functionDefinition,
    error: functionError,
  } = data || {
    functionMetadata: null,
    functionDefinition: '',
    error: null,
  };

  const functionName = functionMetadata?.functionName;

  const { data: isTracked } = useIsTrackedFunction({
    dataSource,
    schema,
    functionName: functionName || '',
    enabled: !!functionName,
  });

  const { data: functionConfig } = useFunctionCustomizationQuery({
    function: { name: functionName || '', schema },
    dataSource,
  });

  const { openDrawer } = useDialog();

  const [isSourceOpen, setIsSourceOpen] = useState(true);

  const effectiveExposedAs =
    functionConfig?.configuration?.exposed_as ??
    (functionMetadata?.functionType === 'VOLATILE' ? 'mutation' : 'query');

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
        description={<span>The function does not exist.</span>}
      />
    );
  }

  const requiredParamsCount =
    functionMetadata.parameters.length - functionMetadata.defaultArgsCount;

  const isCompositeReturn = functionMetadata.returnTypeKind === 'c';
  const isTrackable = isCompositeReturn && !functionMetadata.hasVariadic;

  const returnTypeDisplay = functionMetadata.returnTableName
    ? `${functionMetadata.returnTableSchema}.${functionMetadata.returnTableName}`
    : functionMetadata.returnTypeName;

  const returnPrefix = functionMetadata.returnsSet ? 'SETOF ' : '';

  const nonTrackableReason = !isCompositeReturn
    ? `This function returns the type "${functionMetadata.returnTypeName}", so it can't be exposed in GraphQL.`
    : "This function uses VARIADIC arguments, so it can't be exposed in GraphQL.";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b p-4">
        <div className="mb-8 flex flex-col gap-4">
          {isTrackable && (
            <TrackFunctionButton
              schema={schema}
              functionName={functionMetadata.functionName}
              returnTableName={functionMetadata.returnTableName}
              returnTableSchema={functionMetadata.returnTableSchema}
              functionType={functionMetadata.functionType}
            />
          )}
          {isTrackable && isTracked && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="font-medium text-sm">Tracked in GraphQL</span>
              <Badge variant="outline" className="font-medium">
                Exposed as:{' '}
                {effectiveExposedAs === 'mutation' ? 'Mutation' : 'Query'}
              </Badge>
            </div>
          )}
          {!isTrackable && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Not exposable in GraphQL</AlertTitle>
              <AlertDescription>{nonTrackableReason}</AlertDescription>
            </Alert>
          )}
          <div>
            <h2 className="font-semibold text-lg">Function Definition</h2>
            <p className="text-muted-foreground text-sm">
              <InlineCode className="bg-opacity-80 px-1.5 text-sm">
                {schema}.{functionName}
              </InlineCode>
            </p>
          </div>
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
              · Returns{' '}
              <InlineCode className="bg-opacity-80 px-1 text-xs">
                {returnPrefix}
                {returnTypeDisplay}
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
              {returnPrefix}
              {functionMetadata.returnTypeName}
            </Badge>
            {functionMetadata.returnTableName && (
              <Badge variant="outline" className="font-medium">
                Returns table: {functionMetadata.returnTableSchema}.
                {functionMetadata.returnTableName}
              </Badge>
            )}
            {functionMetadata.hasVariadic && (
              <Badge variant="outline" className="font-medium">
                VARIADIC
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
        {functionDefinition && (
          <Collapsible
            open={isSourceOpen}
            onOpenChange={setIsSourceOpen}
            className="mt-4 rounded-md border"
          >
            <div className="flex items-center justify-between gap-2 p-3">
              <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
                {isSourceOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <h4 className="font-medium text-sm">Source Definition</h4>
              </CollapsibleTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openDrawer({
                    title: 'Function Definition',
                    component: (
                      <EditFunctionForm
                        schema={schema}
                        functionName={functionMetadata.functionName}
                        functionOID={functionOID}
                        dataSource={dataSource}
                      />
                    ),
                  })
                }
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
            <CollapsibleContent>
              <div className="overflow-hidden border-t">
                <CodeMirror
                  value={functionDefinition}
                  theme={
                    theme.palette.mode === 'light' ? githubLight : githubDark
                  }
                  extensions={[sql({ dialect: PostgreSQL })]}
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: false,
                  }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
