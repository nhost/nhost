import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { SquarePen } from 'lucide-react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface EditFunctionFormProps {
  /**
   * Schema where the function is located.
   */
  schema: string;
  /**
   * Function name.
   */
  functionName: string;
  /**
   * Function to be called when the form is submitted.
   * Optional since functions don't have a traditional form submission.
   */
  onSubmit?: (functionName: string) => Promise<void>;
}

export default function EditFunctionForm({
  schema,
  functionName,
}: EditFunctionFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const {
    query: { dataSourceSlug },
  } = router;
  const { project } = useProject();
  const { org } = useCurrentOrg();

  const dataSource = (dataSourceSlug as string) || 'default';
  const currentTablePath = `${dataSource}.${schema}.${functionName}`;

  const { data, status, error } = useFunctionQuery(
    ['function-definition', currentTablePath],
    {
      table: functionName,
      schema,
      dataSource,
      queryOptions: {
        enabled: !!schema && !!functionName,
      },
    },
  );

  const { functionDefinition, error: functionError } = data || {
    functionDefinition: '',
    error: null,
  };

  function handleModify() {
    // Store function definition in sessionStorage (not in URL to avoid logs/history)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pending-sql', functionDefinition);
    }

    // Navigate to editor
    const orgSlug = (router.query.orgSlug as string) || org?.slug || '';
    const appSubdomain =
      (router.query.appSubdomain as string) || project?.subdomain || '';
    const editorPath = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSource}/editor`;
    router.push(editorPath);
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
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div>
          <h2 className="font-semibold text-lg">Function Definition</h2>
          <p className="text-muted-foreground text-sm">
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {schema}.{functionName}
            </InlineCode>
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleModify}
          className="gap-2"
        >
          <SquarePen className="h-4 w-4" />
          Modify
        </Button>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <CodeMirror
          value={functionDefinition}
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
