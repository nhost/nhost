import { Plus, Search, Shapes } from 'lucide-react';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { Input } from '@/components/ui/v3/input';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import DatabaseSearchIcon from '@/features/orgs/projects/database/native-queries/components/DatabaseSearchIcon';
import DeleteLogicalModelDialog from '@/features/orgs/projects/database/native-queries/components/DeleteLogicalModelDialog';
import DeleteNativeQueryDialog from '@/features/orgs/projects/database/native-queries/components/DeleteNativeQueryDialog';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import LogicalModelListItem from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/LogicalModelListItem';
import NativeQueriesBrowserSidebarSkeleton from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesBrowserSidebarSkeleton';
import NativeQueryListItem from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueryListItem';
import { CreateNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/NativeQueryForms';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useGetNativeQueries from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

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
  const [queryToDelete, setQueryToDelete] = useState<NativeQueryItem | null>(
    null,
  );

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
      <div className="flex shrink-0 flex-col gap-2 px-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search models and queries..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 pl-8 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="link"
              className="!text-sm+ flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline"
            >
              New <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 text-foreground">
            <DropdownMenuItem
              onSelect={() =>
                openDrawer({
                  title: 'Create logical model',
                  component: <CreateLogicalModelForm />,
                })
              }
            >
              <Shapes className="mr-2 size-4" />
              Logical model
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                openDrawer({
                  title: 'Create native query',
                  component: <CreateNativeQueryForm />,
                })
              }
            >
              <DatabaseSearchIcon className="mr-2 size-4" />
              Native query
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2"
        aria-label="Native queries navigation"
      >
        <section
          className="mt-2"
          aria-labelledby="native-queries-section-heading"
        >
          <h2
            id="native-queries-section-heading"
            className="px-2 py-1.5 font-medium text-muted-foreground text-xs"
          >
            Native queries
          </h2>
          {filteredQueries.length > 0 ? (
            filteredQueries.map((query) => (
              <NativeQueryListItem
                key={query.root_field_name}
                query={query}
                onDelete={setQueryToDelete}
              />
            ))
          ) : (
            <p className="px-2 py-1.5 text-muted-foreground text-xs">
              {queries.length === 0
                ? 'No native queries yet.'
                : 'No native queries match your search.'}
            </p>
          )}
        </section>

        <section aria-labelledby="logical-models-section-heading">
          <h2
            id="logical-models-section-heading"
            className="px-2 py-1.5 font-medium text-muted-foreground text-xs"
          >
            Logical models
          </h2>
          {filteredModels.length > 0 ? (
            filteredModels.map((model) => (
              <LogicalModelListItem
                key={model.name}
                model={model}
                onDelete={setModelToDelete}
              />
            ))
          ) : (
            <p className="px-2 py-1.5 text-muted-foreground text-xs">
              {models.length === 0
                ? 'No logical models yet.'
                : 'No logical models match your search.'}
            </p>
          )}
        </section>
      </nav>

      <DeleteLogicalModelDialog
        open={Boolean(modelToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setModelToDelete(null);
          }
        }}
        model={modelToDelete}
      />
      <DeleteNativeQueryDialog
        open={Boolean(queryToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setQueryToDelete(null);
          }
        }}
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
