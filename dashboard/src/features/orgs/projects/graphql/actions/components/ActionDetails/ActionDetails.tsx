import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  FilePen,
  FileSearch,
  MessageSquareText,
} from 'lucide-react';
import { useRouter } from 'next/router';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ActionsEmptyState } from '@/features/orgs/projects/graphql/actions/components/ActionsEmptyState';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { isNotEmptyValue } from '@/lib/utils';
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

  if (isLoading || !actionSlug) {
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

  if (!action) {
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

  const { comment, definition } = action;
  const actionType = definition.type ?? 'mutation';
  const ActionTypeIcon = actionType === 'query' ? FileSearch : FilePen;
  const hasHeaders = Boolean(definition.forward_client_headers);
  const hasMetadata = isNotEmptyValue(comment) || hasHeaders;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 bg-background px-6 pt-6 pb-0">
        <div className="pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
              <ActionTypeIcon className="h-6 w-6 text-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="mb-1 font-semibold text-foreground text-xl">
                {action.name}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex w-fit cursor-default items-center gap-1.5 text-muted-foreground text-sm">
                    {actionType === 'query' ? (
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpFromLine className="h-3.5 w-3.5" />
                    )}
                    {actionType === 'query' ? 'Query' : 'Mutation'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {actionType === 'query'
                    ? 'Read-only operation'
                    : 'Modifies data'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {hasMetadata && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
              {isNotEmptyValue(comment) && (
                <>
                  <span className="flex min-w-0 items-start gap-1.5">
                    <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <TextWithTooltip
                      text={comment}
                      maxLines={3}
                      className="max-w-prose break-words"
                    />
                  </span>
                  {hasHeaders && <MetadataSeparator />}
                </>
              )}
              {hasHeaders && (
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
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <ActionOverview
          action={action}
          customTypes={actionsData?.customTypes ?? {}}
        />
      </div>
    </div>
  );
}
