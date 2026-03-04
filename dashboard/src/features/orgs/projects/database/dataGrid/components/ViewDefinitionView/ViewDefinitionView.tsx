import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useSqlEditorPrefill } from '@/features/orgs/projects/database/dataGrid/hooks/useSqlEditorPrefill';
import { useViewDefinitionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useViewDefinitionQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface ViewDefinitionViewProps {
  schema: string;
  table: string;
}

export default function ViewDefinitionView({
  schema,
  table,
}: ViewDefinitionViewProps) {
  const theme = useTheme();
  const {
    push,
    query: { orgSlug, appSubdomain, dataSourceSlug },
  } = useRouter();
  const dataSource = dataSourceSlug as string;
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const { prefill } = useSqlEditorPrefill();

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

  function handleModify() {
    const isMaterialized = viewType === 'MATERIALIZED VIEW';

    let sqlCode: string;
    if (isMaterialized) {
      const dropStatement = `DROP MATERIALIZED VIEW "${schema}"."${table}";`;
      const createStatement = `CREATE MATERIALIZED VIEW "${schema}"."${table}" AS\n${viewDefinition}`;
      sqlCode = `${dropStatement}\n${createStatement}`;
    } else {
      sqlCode = `CREATE OR REPLACE VIEW "${schema}"."${table}" AS\n${viewDefinition}`;
    }

    prefill(sqlCode);

    const resolvedOrgSlug = (orgSlug as string) || org?.slug || '';
    const resolvedAppSubdomain =
      (appSubdomain as string) || project?.subdomain || '';
    const editorPath = `/orgs/${resolvedOrgSlug}/projects/${resolvedAppSubdomain}/database/browser/${dataSource}/editor`;
    push(editorPath);
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
          <p className="text-muted-foreground text-sm">
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {schema}.{table}
            </InlineCode>
            <span className="ml-2 text-muted-foreground text-xs">
              ({viewType})
            </span>
          </p>
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
          extensions={[sql({ dialect: PostgreSQL })]}
          editable={false}
          readOnly={true}
        />
      </div>
    </div>
  );
}
