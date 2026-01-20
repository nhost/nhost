import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useViewDefinitionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useViewDefinitionQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface ViewDefinitionViewProps {
  schema: string;
  table: string;
  dataSource?: string;
}

export default function ViewDefinitionView({
  schema,
  table,
  dataSource,
}: ViewDefinitionViewProps) {
  const theme = useTheme();
  const router = useRouter();
  const { project } = useProject();
  const { org } = useCurrentOrg();

  const {
    data,
    status,
    error: queryError,
  } = useViewDefinitionQuery(
    ['view-definition', dataSource || 'default', schema, table],
    {
      schema,
      table,
      dataSource: dataSource || 'default',
      queryOptions: {
        enabled: !!schema && !!table,
      },
    },
  );

  const {
    viewDefinition,
    viewType,
    error: viewError,
  } = data || {
    viewDefinition: '',
    viewType: 'VIEW' as const,
    error: null,
  };

  function handleModify() {
    // Generate SQL with DROP and CREATE statements
    const isMaterialized = viewType === 'MATERIALIZED VIEW';
    const materializedKeyword = isMaterialized ? 'MATERIALIZED ' : '';
    const dropStatement = `DROP ${materializedKeyword}VIEW "${schema}"."${table}";`;
    const createStatement = `CREATE ${materializedKeyword}VIEW "${schema}"."${table}" AS\n${viewDefinition};`;
    const sqlCode = `${dropStatement}\n${createStatement}`;

    // Store SQL in sessionStorage (not in URL to avoid logs/history)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pending-sql', sqlCode);
    }

    // Navigate to editor (no query params needed)
    // Use router.query if available, otherwise fall back to project/org data
    const orgSlug = (router.query.orgSlug as string) || org?.slug || '';
    const appSubdomain =
      (router.query.appSubdomain as string) || project?.subdomain || '';
    const editorPath = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSource || 'default'}/editor`;
    router.push(editorPath);
  }

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
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">View Definition</h2>
            <p className="text-muted-foreground text-sm">
              <InlineCode className="bg-opacity-80 px-1.5 text-sm">
                {schema}.{table}
              </InlineCode>
              <span className="ml-2 text-muted-foreground text-xs">
                ({viewType})
              </span>
            </p>
          </div>
          <Button variant="default" onClick={handleModify}>
            Modify
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <CodeMirror
          value={viewDefinition}
          height="100%"
          className="h-full max-h-120 w-full"
          theme={theme.palette.mode === 'light' ? githubLight : githubDark}
          editable={false}
          readOnly={true}
        />
      </div>
    </div>
  );
}
