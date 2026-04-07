import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';

export interface EditFunctionFormProps {
  schema: string;
  functionName: string;
  functionOID: string;
  dataSource: string;
}

export default function EditFunctionForm({
  schema,
  functionName,
  functionOID,
  dataSource,
}: EditFunctionFormProps) {
  const cacheKey = `${dataSource}.${functionOID}`;

  const {
    data,
    status,
    error: queryError,
  } = useFunctionQuery(['function-definition', cacheKey], {
    functionOID,
    dataSource,
    queryOptions: {
      enabled: !!functionOID,
    },
  });

  const { functionDefinition, error: functionError } = data || {
    functionDefinition: '',
    error: null,
  };

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
      <SQLEditor initialSQL={functionDefinition} />
    </div>
  );
}
