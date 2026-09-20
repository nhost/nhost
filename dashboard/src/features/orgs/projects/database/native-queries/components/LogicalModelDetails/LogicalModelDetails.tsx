import { Shapes } from 'lucide-react';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { EditLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelForm';
import { NativeQueriesDetailsHeader } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesDetailsHeader';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import LogicalModelDetailsSkeleton from './LogicalModelDetailsSkeleton';
import LogicalModelOverview from './sections/LogicalModelOverview';

export default function LogicalModelDetails() {
  const router = useRouter();
  const { modelSlug, orgSlug, appSubdomain } = router.query;
  const { data: models = [], isLoading, error } = useGetLogicalModels();
  const {
    data: queries = [],
    isLoading: queriesLoading,
    error: queriesError,
  } = useGetNativeQueries();
  const { openDrawer } = useDialog();

  if (error instanceof Error) {
    throw error;
  }

  if (queriesError instanceof Error) {
    throw queriesError;
  }

  if (isLoading || queriesLoading || !modelSlug) {
    return <LogicalModelDetailsSkeleton />;
  }

  const model = models.find((item) => item.name === modelSlug);

  if (!model) {
    return (
      <NativeQueriesEmptyState
        title="Logical model not found"
        description={
          <span>
            Logical model <InlineCode>{modelSlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <NativeQueriesDetailsHeader
        icon={<Shapes className="h-6 w-6 text-foreground" />}
        title={model.name}
        subtitle="Logical model"
        description={model.description?.trim()}
        onEdit={() =>
          openDrawer({
            title: (
              <span className="inline-grid grid-flow-col items-center gap-2">
                Edit
                <InlineCode className="!text-sm+ font-normal">
                  {model.name}
                </InlineCode>
                logical model
              </span>
            ),
            component: <EditLogicalModelForm model={model} />,
          })
        }
      />

      <LogicalModelOverview
        model={model}
        usedBy={queries.filter((query) => query.returns === model.name)}
        buildQueryHref={(rootFieldName) =>
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default/queries/${encodeURIComponent(rootFieldName)}`
        }
      />
    </div>
  );
}
