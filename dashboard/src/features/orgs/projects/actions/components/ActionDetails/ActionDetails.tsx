import {
  ArrowRightLeft,
  Braces,
  MessageSquareText,
  Timer,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ActionsEmptyState } from '@/features/orgs/projects/actions/components/ActionsEmptyState';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { DEFAULT_ACTION_TIMEOUT_SECONDS } from '@/features/orgs/projects/actions/utils/constants';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import ActionDetailsSkeleton from './ActionDetailsSkeleton';
import ActionOverview from './sections/ActionOverview';

function MetadataSeparator() {
  return (
    <span aria-hidden="true" className="text-muted-foreground/50">
      |
    </span>
  );
}

export default function ActionDetails() {
  const router = useRouter();

  const { actionSlug } = router.query;

  const { data: actionsData, isLoading, error } = useGetActions();

  const action = actionsData?.actions.find(
    (actionItem) => actionItem.name === actionSlug,
  );

  const [tab, setTab] = useState('overview');

  if (isLoading && actionSlug) {
    return <ActionDetailsSkeleton />;
  }

  if (error instanceof Error) {
    return (
      <ActionsEmptyState
        title="Action not found"
        description={
          <span>
            Action{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              {actionSlug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  if (isEmptyValue(action)) {
    return (
      <ActionsEmptyState
        title="Action not found"
        description={
          <span>
            Action{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              {actionSlug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  const { definition } = action!;
  const actionType = definition.type ?? 'mutation';

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 bg-background px-6 pt-6 pb-0">
        <div className="pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
              <Workflow className="h-6 w-6 text-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="mb-1 font-semibold text-foreground text-xl">
                {action!.name}
              </h1>
              <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Webhook className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{definition.handler}</span>
                <CopyToClipboardButton
                  textToCopy={definition.handler}
                  title="Copy handler URL"
                />
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-default items-center gap-1.5">
                  <Braces className="h-3.5 w-3.5" />
                  {actionType}
                </span>
              </TooltipTrigger>
              <TooltipContent>Action type</TooltipContent>
            </Tooltip>
            {actionType === 'mutation' && (
              <>
                <MetadataSeparator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      {definition.kind ?? 'synchronous'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Execution kind</TooltipContent>
                </Tooltip>
              </>
            )}
            <MetadataSeparator />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-default items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5" />
                  {definition.timeout ?? DEFAULT_ACTION_TIMEOUT_SECONDS}s
                </span>
              </TooltipTrigger>
              <TooltipContent>Handler timeout</TooltipContent>
            </Tooltip>
            {definition.forward_client_headers && (
              <>
                <MetadataSeparator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Forwards client headers
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Headers sent by the client app are forwarded to the action
                    handler
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            {isNotEmptyValue(action!.comment) && (
              <>
                <MetadataSeparator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex min-w-0 cursor-default items-center gap-1.5">
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{action!.comment}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{action!.comment}</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="my-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'overview' && (
        <div className="flex-1 overflow-auto p-6">
          <ActionOverview
            action={action!}
            customTypes={actionsData?.customTypes ?? {}}
          />
        </div>
      )}
    </div>
  );
}
