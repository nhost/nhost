import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { FileSearch } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryForm';
import { NativeQueriesDetailsHeader } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesDetailsHeader';
import { NativeQueriesDetailsSection } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesDetailsSection';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useThemePreference } from '@/providers/Theme';

export default function NativeQueryDetails() {
  const router = useRouter();
  const { resolvedTheme } = useThemePreference();
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
      <NativeQueriesDetailsHeader
        icon={<FileSearch className="h-6 w-6 text-foreground" />}
        title={query.root_field_name}
        subtitle="Native query"
        description={description}
        onEdit={() =>
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
      />

      <div className="flex-1 space-y-4 overflow-auto p-6">
        <NativeQueriesDetailsSection title="SQL">
          <section className="border-t p-4" aria-label="Native query SQL">
            <CodeMirror
              value={query.code}
              minHeight="180px"
              className="overflow-hidden rounded-md border"
              theme={resolvedTheme === 'light' ? githubLight : githubDark}
              extensions={[sql({ dialect: PostgreSQL })]}
              editable={false}
              readOnly
            />
          </section>
        </NativeQueriesDetailsSection>

        <NativeQueriesDetailsSection title="Returns">
          <div className="border-t p-4 text-sm">
            <NextLink href={modelHref} className="text-primary hover:underline">
              {query.returns}
            </NextLink>
          </div>
        </NativeQueriesDetailsSection>

        <NativeQueriesDetailsSection title="Arguments">
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
        </NativeQueriesDetailsSection>
      </div>
    </div>
  );
}
