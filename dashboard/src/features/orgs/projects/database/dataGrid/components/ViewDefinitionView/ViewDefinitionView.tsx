import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { useViewDefinitionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useViewDefinitionQuery';
import { getDatabaseObjectDefinitionSQL } from '@/features/orgs/projects/database/dataGrid/utils/getDatabaseObjectDefinitionSQL';

export interface ViewDefinitionViewProps {
  schema: string;
  table: string;
  dataSource: string;
}

export default function ViewDefinitionView({
  schema,
  table,
  dataSource,
}: ViewDefinitionViewProps) {
  const {
    data,
    status,
    error: queryError,
  } = useViewDefinitionQuery(['view-definition', dataSource, schema, table], {
    schema,
    table,
    dataSource,
    queryOptions: {
      enabled: !!schema && !!table,
    },
  });

  const {
    viewDefinition,
    viewType,
    error: viewError,
  } = data || {
    viewDefinition: '',
    viewType: 'VIEW' as const,
    error: null,
  };

  const initialSQL = getDatabaseObjectDefinitionSQL(
    schema,
    table,
    viewDefinition,
    viewType,
  );

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner
          wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
          className="h-4 w-4 justify-center"
        >
          Loading view definition...
        </Spinner>
      </div>
    );
  }

  if (status === 'error' || viewError) {
    return (
      <DataBrowserEmptyState
        title="Error loading view"
        description={
          <span>
            {queryError instanceof Error
              ? queryError.message
              : viewError || 'Unknown error occurred. Please try again later.'}
          </span>
        }
      />
    );
  }

  if (!viewDefinition) {
    return (
      <DataBrowserEmptyState
        title="View not found"
        description={
          <span>
            View{' '}
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {schema}.{table}
            </InlineCode>{' '}
            does not exist or is not a view or materialized view.
          </span>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <p className="border-b px-4 py-3 text-muted-foreground text-sm">
        <InlineCode className="bg-opacity-80 px-1.5 text-sm">
          {schema}.{table}
        </InlineCode>
        <span className="ml-1 text-xs">({viewType})</span>
      </p>
      <SQLEditor initialSQL={initialSQL} />
    </div>
  );
}
