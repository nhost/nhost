import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import {
  ChevronDown,
  FileSearch,
  MessageSquareText,
  Pencil,
} from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import NativeQueriesEmptyState from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/NativeQueryForms';
import useGetNativeQueries from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';

export default function NativeQueryDetails() {
  const router = useRouter();
  const theme = useTheme();
  const { querySlug, orgSlug, appSubdomain, dataSourceSlug } = router.query;
  const { data: queries = [], isLoading, error } = useGetNativeQueries();
  const { openDrawer } = useDialog();

  if (error instanceof Error) {
    throw error;
  }

  if (dataSourceSlug && dataSourceSlug !== 'default') {
    return (
      <NativeQueriesEmptyState
        title="Database not found"
        description={
          <span>
            Database <InlineCode>{dataSourceSlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  if (isLoading || !querySlug) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const query = queries.find((item) => item.root_field_name === querySlug);

  if (!query) {
    return (
      <NativeQueriesEmptyState
        title="Native query not found"
        description={
          <span>
            Native query <InlineCode>{querySlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  const description = query.comment?.trim();
  const argumentsList = Object.entries(query.arguments ?? {});
  const modelHref = `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}/models/${query.returns}`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 px-6 pt-6 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileSearch className="h-6 w-6 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 font-semibold text-foreground text-xl">
              {query.root_field_name}
            </h1>
            <span className="text-muted-foreground text-sm">Native query</span>
            {description != null && description.length > 0 && (
              <div className="mt-3 flex max-w-prose items-start gap-2 text-muted-foreground text-sm">
                <MessageSquareText className="mt-0.5 size-4 shrink-0" />
                <TextWithTooltip
                  text={description}
                  maxLines={3}
                  containerClassName="min-w-0 flex-1"
                  className="break-words"
                />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openDrawer({
                title: (
                  <span className="inline-grid grid-flow-col items-center gap-2">
                    Edit
                    <InlineCode className="!text-sm+ font-normal">
                      {query.root_field_name}
                    </InlineCode>
                    native query
                  </span>
                ),
                component: <EditNativeQueryForm query={query} />,
              })
            }
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-6">
        <Collapsible defaultOpen className="rounded border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
            SQL
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <section className="border-t p-4" aria-label="Native query SQL">
              <CodeMirror
                value={query.code}
                minHeight="180px"
                className="overflow-hidden rounded-md border"
                theme={
                  theme.palette.mode === 'light' ? githubLight : githubDark
                }
                extensions={[sql({ dialect: PostgreSQL })]}
                editable={false}
                readOnly
              />
            </section>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen className="rounded border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
            Returns
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4 text-sm">
              <NextLink
                href={modelHref}
                className="text-primary hover:underline"
              >
                {query.returns}
              </NextLink>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen className="rounded border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
            Arguments
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {argumentsList.length === 0 ? (
              <p className="border-t p-4 text-muted-foreground text-sm">
                This native query has no arguments.
              </p>
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Nullable</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {argumentsList.map(([name, argument]) => (
                      <tr key={name} className="border-t first:border-t-0">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {name}
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {argument.type}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {argument.nullable ? 'Yes' : 'No'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {argument.description?.trim() || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
