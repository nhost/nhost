import { Braces, Plus, Search } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { CreateActionForm } from '@/features/orgs/projects/actions/components/CreateActionForm';
import { DeleteActionDialog } from '@/features/orgs/projects/actions/components/DeleteActionDialog';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';
import ActionListItem from './ActionListItem';
import ActionsBrowserSidebarSkeleton from './ActionsBrowserSidebarSkeleton';

function ActionsBrowserSidebarContent() {
  const {
    data: actionsData,
    isLoading: isLoadingActions,
    error: errorActions,
  } = useGetActions();

  const {
    asPath,
    query: { orgSlug, appSubdomain },
  } = useRouter();

  const { openDrawer } = useDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionToDelete, setActionToDelete] = useState<ActionItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleCreateAction = useCallback(() => {
    openDrawer({
      title: 'Create a New Action',
      component: <CreateActionForm />,
    });
  }, [openDrawer]);

  const handleDeleteAction = useCallback((action: ActionItem) => {
    setActionToDelete(action);
    setIsDeleteDialogOpen(true);
  }, []);

  if (isLoadingActions) {
    return <ActionsBrowserSidebarSkeleton />;
  }

  if (errorActions instanceof Error) {
    return (
      <div className="flex h-full flex-col px-2">
        <div className="flex flex-row items-center justify-between">
          <p className="font-medium leading-7 [&:not(:first-child)]:mt-6">
            Actions could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const actions = actionsData?.actions ?? [];

  const filteredActions = searchQuery
    ? actions.filter((action) =>
        action.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : actions;

  const customTypesHref = `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/actions/custom-types`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-2">
        {actions.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 pl-8 text-sm"
            />
          </div>
        )}
        <div className="flex flex-row items-center justify-between">
          <Button
            variant="link"
            className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
            onClick={handleCreateAction}
          >
            New Action <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {actions.length > 0 && filteredActions.length === 0 && (
          <p className="px-2 py-1.5 text-disabled text-xs">No actions found.</p>
        )}
        <div className="mt-2 flex flex-col text-balance">
          {filteredActions.map((action) => (
            <ActionListItem
              key={action.name}
              action={action}
              onDeleteAction={handleDeleteAction}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t">
        <Button
          size="sm"
          variant="link"
          asChild
          className={cn(
            'flex rounded-none border text-sm+ hover:bg-accent hover:no-underline',
            {
              'bg-table-selected text-primary-main': asPath === customTypesHref,
            },
          )}
        >
          <NextLink href={customTypesHref}>
            <div className="flex w-full flex-row items-center justify-center space-x-2">
              <Braces className="h-4 w-4" />
              <span className="flex">Custom Types Editor</span>
            </div>
          </NextLink>
        </Button>
      </div>

      {actionToDelete && (
        <DeleteActionDialog
          open={isDeleteDialogOpen}
          setOpen={setIsDeleteDialogOpen}
          actionToDelete={actionToDelete}
        />
      )}
    </div>
  );
}

export default function ActionsBrowserSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar>
      <ActionsBrowserSidebarContent />
    </FeatureSidebar>
  );
}
