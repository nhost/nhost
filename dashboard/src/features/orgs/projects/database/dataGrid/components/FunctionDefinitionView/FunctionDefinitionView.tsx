import { Spinner } from '@/components/ui/v3/spinner';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useRouter } from 'next/router';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { InlineCode } from '@/components/ui/v3/inline-code';

export default function FunctionDefinitionView() {
  const theme = useTheme();
  const router = useRouter();
  const {
    query: { schemaSlug, tableSlug },
  } = router;
  const currentTablePath = useTablePath();

  const { data, status, error } = useFunctionQuery(
    ['function-definition', currentTablePath],
    {
      queryOptions: {
        enabled: !!currentTablePath,
      },
    },
  );

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
            {error instanceof Error
              ? error.message
              : functionError || 'Unknown error occurred. Please try again later.'}
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
              {schemaSlug}.{tableSlug}
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
        <h2 className="font-semibold text-lg">Function Definition</h2>
        <p className="text-muted-foreground text-sm">
          <InlineCode className="bg-opacity-80 px-1.5 text-sm">
            {schemaSlug}.{tableSlug}
          </InlineCode>
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={functionDefinition}
          height="100%"
          className="h-full w-full"
          theme={theme.palette.mode === 'light' ? githubLight : githubDark}
          extensions={[sql({ dialect: PostgreSQL })]}
          editable={false}
          readOnly={true}
        />
      </div>
    </div>
  );
}
