import { Ellipsis, SquarePen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  AgentForm,
  toolsConfigToFormValues,
} from '@/features/orgs/projects/ai/AgentForm';
import { createAgentMutationCallbacks } from '@/features/orgs/projects/ai/agents/components/AgentsBrowserSidebar/agent-mutation-callbacks';
import { DeleteAgentModal } from '@/features/orgs/projects/ai/DeleteAgentModal';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { cn } from '@/lib/utils';
import type { Agent } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/agents';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

export interface AgentListItemProps {
  agent: Agent;
  refetchAgents: () => Promise<unknown>;
}

export default function AgentListItem({
  agent,
  refetchAgents,
}: AgentListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, agentId: currentAgentId } = router.query;
  const { openDrawer, openDialog, closeDialog } = useDialog();
  const isSelected = agent.id === currentAgentId;
  const agentsIndexHref = `/orgs/${orgSlug}/projects/${appSubdomain}/ai/agents`;
  const href = `${agentsIndexHref}/${agent.id}`;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { onSubmit, onDelete } = createAgentMutationCallbacks({
    refetchAgents,
    redirectAfterDelete: isSelected
      ? async () => {
          await router.replace(agentsIndexHref);
        }
      : undefined,
  });

  const handleEdit = () => {
    openDrawer({
      title: `Edit ${agent.name}`,
      component: (
        <AgentForm
          agentId={agent.id}
          initialData={{
            name: agent.name,
            description: agent.description,
            instructions: agent.instructions,
            provider: agent.provider,
            model: agent.model,
            ...toolsConfigToFormValues(agent.toolsConfig),
          }}
          onSubmit={onSubmit}
        />
      ),
    });
  };

  const handleDelete = () => {
    openDialog({
      component: (
        <DeleteAgentModal
          agent={agent}
          close={closeDialog}
          onDelete={onDelete}
        />
      ),
    });
  };

  return (
    <div className="group pb-1">
      <Button
        asChild
        variant="link"
        size="sm"
        className={cn(
          'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
          {
            'bg-table-selected': isSelected,
          },
        )}
      >
        <div className="flex w-full max-w-full items-center">
          <Link
            href={href}
            className={cn(
              'flex h-full w-[calc(100%-1.6rem)] items-center p-[0.625rem] pr-0 text-left',
              {
                'text-primary-main': isSelected,
              },
            )}
          >
            <TextWithTooltip
              containerClassName="w-full"
              className={cn('!truncate text-sm+', {
                'text-primary-main': isSelected,
              })}
              text={agent.name}
            />
          </Link>

          <DropdownMenu
            modal={false}
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <DropdownMenuTrigger
              asChild
              className={cn(
                'relative z-10 opacity-0 transition-opacity group-hover:opacity-100',
                {
                  'opacity-100': isSelected || isMenuOpen,
                },
              )}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <Ellipsis className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              className="w-52 p-0"
              forceMount
            >
              <DropdownMenuItem
                onSelect={handleEdit}
                className={menuItemClassName}
              >
                <SquarePen className="size-4" />
                Edit Agent
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleDelete}
                className={cn(
                  menuItemClassName,
                  'text-destructive focus:text-destructive',
                )}
              >
                <Trash2 className="size-4" />
                Delete Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Button>
    </div>
  );
}
