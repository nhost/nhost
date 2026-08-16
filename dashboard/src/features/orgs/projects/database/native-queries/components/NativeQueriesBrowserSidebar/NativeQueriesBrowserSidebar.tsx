import { Plus, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DeleteLogicalModelDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteLogicalModelDialog';
import { DeleteNativeQueryDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteNativeQueryDialog';
import { LogicalModelListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/LogicalModelListItem';
import { NativeQueriesBrowserSidebarSkeleton } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesBrowserSidebarSkeleton';
import { NativeQueryListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueryListItem';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const CreateLogicalModelForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm'
    ).then((mod) => mod.CreateLogicalModelForm),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const CreateNativeQueryForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/CreateNativeQueryForm'
    ).then((mod) => mod.CreateNativeQueryForm),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

function NativeQueriesBrowserSidebarContent() {
  const modelsResult = useGetLogicalModels();
  const queriesResult = useGetNativeQueries();
  const models = modelsResult.data ?? [];
  const queries = queriesResult.data ?? [];
  const { openDrawer } = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [modelToDelete, setModelToDelete] = useState<LogicalModelItem | null>(
    null,
  );
  const [deleteModelDialogOpen, setDeleteModelDialogOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState<NativeQueryItem | null>(
    null,
  );
  const [deleteQueryDialogOpen, setDeleteQueryDialogOpen] = useState(false);

  if (modelsResult.isLoading || queriesResult.isLoading) {
    return <NativeQueriesBrowserSidebarSkeleton />;
  }

  if (
    modelsResult.error instanceof Error ||
    queriesResult.error instanceof Error
  ) {
    return (
      <div className="flex h-full flex-col px-2">
        <p className="font-medium leading-7">
          Models and queries could not be loaded.
        </p>
      </div>
    );
  }

  const normalizedSearchQuery = searchQuery.toLowerCase();
  const filteredQueries = queries
    .filter((query) =>
      query.root_field_name.toLowerCase().includes(normalizedSearchQuery),
    )
    .sort((left, right) =>
      left.root_field_name.localeCompare(right.root_field_name),
    );
  const filteredModels = models
    .filter((model) => model.name.toLowerCase().includes(normalizedSearchQuery))
    .sort((left, right) => left.name.localeCompare(right.name));

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search objects..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 pl-8 text-sm"
          />
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2"
        aria-label="Native queries navigation"
      >
        <div className="mt-3 space-y-6 pb-4">
          <section aria-labelledby="native-queries-section-heading">
            <div className="flex items-center justify-between border-b px-2 py-1.5">
              <h3
                id="native-queries-section-heading"
                className="font-semibold text-sm"
              >
                Native queries
              </h3>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="font-medium text-muted-foreground text-xs tabular-nums"
                >
                  {filteredQueries.length}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-primary"
                      aria-label="New native query"
                      onClick={() =>
                        openDrawer({
                          title: 'Create native query',
                          component: <CreateNativeQueryForm />,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New native query</TooltipContent>
                </Tooltip>
              </span>
            </div>
            <div className="pt-2">
              {filteredQueries.length > 0 ? (
                filteredQueries.map((query) => (
                  <NativeQueryListItem
                    key={query.root_field_name}
                    query={query}
                    onDelete={(queryItem) => {
                      setQueryToDelete(queryItem);
                      setDeleteQueryDialogOpen(true);
                    }}
                  />
                ))
              ) : (
                <p className="px-2 py-1.5 text-muted-foreground text-xs">
                  {queries.length === 0
                    ? 'No native queries yet.'
                    : 'No native queries match your search.'}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="logical-models-section-heading">
            <div className="flex items-center justify-between border-b px-2 py-1.5">
              <h3
                id="logical-models-section-heading"
                className="font-semibold text-sm"
              >
                Logical models
              </h3>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="font-medium text-muted-foreground text-xs tabular-nums"
                >
                  {filteredModels.length}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-primary"
                      aria-label="New logical model"
                      onClick={() =>
                        openDrawer({
                          title: 'Create logical model',
                          component: <CreateLogicalModelForm />,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New logical model</TooltipContent>
                </Tooltip>
              </span>
            </div>
            <div className="pt-2">
              {filteredModels.length > 0 ? (
                filteredModels.map((model) => (
                  <LogicalModelListItem
                    key={model.name}
                    model={model}
                    onDelete={(modelItem) => {
                      setModelToDelete(modelItem);
                      setDeleteModelDialogOpen(true);
                    }}
                  />
                ))
              ) : (
                <p className="px-2 py-1.5 text-muted-foreground text-xs">
                  {models.length === 0
                    ? 'No logical models yet.'
                    : 'No logical models match your search.'}
                </p>
              )}
            </div>
          </section>
        </div>
      </nav>

      <DeleteLogicalModelDialog
        open={deleteModelDialogOpen}
        setOpen={setDeleteModelDialogOpen}
        model={modelToDelete}
      />
      <DeleteNativeQueryDialog
        open={deleteQueryDialogOpen}
        setOpen={setDeleteQueryDialogOpen}
        query={queryToDelete}
      />
    </div>
  );
}

export default function NativeQueriesBrowserSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar toggleOffset="left-8">
      <NativeQueriesBrowserSidebarContent />
    </FeatureSidebar>
  );
}
