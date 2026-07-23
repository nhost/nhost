import { FileSearch, Plus, Search, Shapes } from 'lucide-react';
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
import DeleteLogicalModelDialog from '@/features/orgs/projects/database/native-queries/components/DeleteLogicalModelDialog';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import LogicalModelListItem from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/LogicalModelListItem';
import NativeQueriesBrowserSidebarSkeleton from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesBrowserSidebarSkeleton';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

function NativeQueriesBrowserSidebarContent() {
  const { data: models = [], isLoading, error } = useGetLogicalModels();
  const { openDrawer } = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [modelToDelete, setModelToDelete] = useState<LogicalModelItem | null>(
    null,
  );

  if (isLoading) {
    return <NativeQueriesBrowserSidebarSkeleton />;
  }

  if (error instanceof Error) {
    return (
      <div className="flex h-full flex-col px-2">
        <p className="font-medium leading-7">
          Logical models could not be loaded.
        </p>
      </div>
    );
  }

  const filteredModels = models
    .filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
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
            <DropdownMenuItem disabled>
              <FileSearch className="mr-2 size-4" />
              <span className="flex flex-col">
                Native query
                <span className="text-muted-foreground text-xs">
                  Coming soon
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {models.length > 0 && filteredModels.length === 0 && (
          <p className="px-2 py-1.5 text-muted-foreground text-xs">
            No models or queries found.
          </p>
        )}
        <nav className="mt-2" aria-label="Native queries navigation">
          {filteredModels.map((model) => (
            <LogicalModelListItem
              key={model.name}
              model={model}
              onDelete={setModelToDelete}
            />
          ))}
        </nav>
      </div>

      <DeleteLogicalModelDialog
        open={Boolean(modelToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setModelToDelete(null);
          }
        }}
        model={modelToDelete}
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
