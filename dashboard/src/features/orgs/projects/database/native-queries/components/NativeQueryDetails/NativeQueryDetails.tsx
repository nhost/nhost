import { FileSearch } from 'lucide-react';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryForm';
import { NativeQueriesDetailsHeader } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesDetailsHeader';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import NativeQueryDetailsSkeleton from './NativeQueryDetailsSkeleton';
import NativeQueryOverview from './sections/NativeQueryOverview';

export default function NativeQueryDetails() {
  const router = useRouter();
  const { querySlug, orgSlug, appSubdomain } = router.query;
  const { data: queries = [], isLoading, error } = useGetNativeQueries();
  const { openDrawer } = useDialog();

  if (error instanceof Error) {
    throw error;
  }

  if (isLoading || !querySlug) {
    return <NativeQueryDetailsSkeleton />;
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <NativeQueriesDetailsHeader
        icon={<FileSearch className="h-6 w-6 text-foreground" />}
        title={query.root_field_name}
        subtitle="Native query"
        description={query.description?.trim()}
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

      <NativeQueryOverview
        query={query}
        modelHref={`/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default/models/${encodeURIComponent(query.returns)}`}
      />
    </div>
  );
}
