import { type DocumentNode, print } from 'graphql';
import { createClient } from 'graphql-ws';
import { useEffect, useRef } from 'react';
import { useSupportSession } from '@/features/support/hooks/useSupportSession';
import { useNhostClient } from '@/providers/nhost';

interface SupportSubscriptionOptions<TData> {
  document: DocumentNode;
  variables: Record<string, unknown>;
  enabled?: boolean;
  onData: (data: TData) => void;
  /** Called after the connection or subscription was re-established, as updates may have been missed. */
  onReconnect?: VoidFunction;
}

function retryDelay(retries: number) {
  return Math.min(1000 * 2 ** retries, 30000);
}

function retryWait(retries: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, retryDelay(retries));
  });
}

// Opens a GraphQL subscription over its own WebSocket, authenticated like the
// support HTTP requests: the connection carries the session token and the
// viewer's support role, and reconnects with fresh headers when Constellation
// closes it at token expiry. graphql-ws ends a subscription on its first
// `error` message, which Constellation sends when a poll fails, so the hook
// subscribes again with the same backoff.
export function useSupportSubscription<TData>({
  document,
  variables,
  enabled = true,
  onData,
  onReconnect,
}: SupportSubscriptionOptions<TData>) {
  const { user, role, requestHeaders } = useSupportSession();
  const nhost = useNhostClient();
  const latest = useRef({ variables, onData, onReconnect, requestHeaders });
  latest.current = { variables, onData, onReconnect, requestHeaders };
  // Resubscribe when the variables' content changes, not their identity.
  const variablesKey = JSON.stringify(variables);
  const userId = user?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: variablesKey stands for the latest variables
  useEffect(() => {
    if (!enabled || !userId) {
      return undefined;
    }
    const client = createClient({
      url: nhost.graphql.url.replace(/^http/, 'ws'),
      retryAttempts: Number.POSITIVE_INFINITY,
      shouldRetry: () => true,
      retryWait,
      connectionParams: async () => ({
        headers: await latest.current.requestHeaders(role),
      }),
      on: {
        connected: (_socket, _payload, wasRetry) => {
          if (wasRetry) {
            latest.current.onReconnect?.();
          }
        },
      },
    });
    let disposed = false;
    let retries = 0;
    let resubscribed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    function subscribe() {
      unsubscribe = client.subscribe<TData>(
        { query: print(document), variables: latest.current.variables },
        {
          next: (result) => {
            retries = 0;
            if (resubscribed) {
              resubscribed = false;
              latest.current.onReconnect?.();
            }
            if (result.data) {
              latest.current.onData(result.data);
            }
          },
          error: (error) => {
            console.error('Support subscription failed', error);
            subscribeLater();
          },
          complete: subscribeLater,
        },
      );
    }
    function subscribeLater() {
      if (disposed) {
        return;
      }
      retryTimer = setTimeout(() => {
        resubscribed = true;
        subscribe();
      }, retryDelay(retries));
      retries += 1;
    }
    subscribe();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      unsubscribe();
      // Disposing during a reconnect rejects with the pending connection's close.
      void Promise.resolve(client.dispose()).catch(() => undefined);
    };
  }, [document, enabled, nhost, role, userId, variablesKey]);
}
