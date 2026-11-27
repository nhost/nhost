import { pick, useGraphiQL } from '@graphiql/react';
import { useState } from 'react';
import {
  describeResponse,
  isOwnedResponseShown,
  type OwnedResponse,
  type ResponseDescription,
  type ResponseTone,
} from '@/features/orgs/projects/graphql/common/utils/describeResponse';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<ResponseTone, string> = {
  busy: 'bg-primary/10 text-primary',
  // No success token yet; same emerald pair as other success badges.
  success:
    'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  error: 'bg-destructive/10 text-destructive',
};

/**
 * The status of the open tab's last run, from GraphiQL's last response. That
 * is one for all tabs, so it only counts on the tab it came from, and only
 * while that tab still shows the response: another user or role clears it,
 * and a run refused for invalid Variables or Headers replaces it.
 */
export function useResponseDescription(): ResponseDescription | null {
  const {
    isFetching,
    subscription,
    executingOperation,
    lastResponse,
    tabs,
    activeTabIndex,
    queryId,
  } = useGraphiQL(
    pick(
      'isFetching',
      'subscription',
      'executingOperation',
      'lastResponse',
      'tabs',
      'activeTabIndex',
      'queryId',
    ),
  );
  const activeTab = tabs[activeTabIndex];
  const activeTabId = activeTab?.id;
  const responseText = activeTab?.response;
  const [owned, setOwned] = useState<OwnedResponse | null>(null);

  // A new response belongs to the tab that ran it: the open one (changing
  // tabs stops a run). GraphiQL writes its text to the tab right after, during
  // the same run.
  if (lastResponse && owned?.response !== lastResponse) {
    setOwned({
      response: lastResponse,
      tabId: activeTabId,
      queryId,
      responseText,
    });
  } else if (
    owned &&
    owned.tabId === activeTabId &&
    owned.queryId === queryId &&
    owned.responseText !== responseText
  ) {
    setOwned({ ...owned, responseText });
  }

  return describeResponse({
    isFetching,
    // GraphiQL streams every request through its transport, queries too, so
    // an open stream alone doesn't mean a subscription.
    isLive:
      subscription !== null && executingOperation?.operation === 'subscription',
    response:
      owned &&
      isOwnedResponseShown(owned, {
        tabId: activeTabId,
        queryId,
        responseText,
      })
        ? owned.response
        : null,
  });
}

/** The status pill, with the time and size after it. */
export default function ResponseStatus({
  description,
}: {
  description: ResponseDescription;
}) {
  const { tone, label, meta } = description;

  return (
    <span
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2"
    >
      <span
        data-testid="graphql-response-status"
        className={cn(
          'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 font-semibold text-xs',
          TONE_CLASSES[tone],
        )}
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {label}
      </span>
      {meta && (
        <span className="truncate text-muted-foreground text-xs">{meta}</span>
      )}
    </span>
  );
}
