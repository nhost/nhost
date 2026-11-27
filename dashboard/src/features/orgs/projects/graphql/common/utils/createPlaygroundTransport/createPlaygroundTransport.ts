import {
  createTransport,
  type SubscriptionClient,
  type Transport,
} from '@graphiql/toolkit';
import { createClient } from 'graphql-ws';
import {
  composeRequestHeaders,
  type GraphQLPlaygroundSelection,
  withRequestHeaders,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { isNotEmptyValue } from '@/lib/utils';

type Track = (event: string, properties?: Record<string, unknown>) => void;

interface CreatePlaygroundTransportOptions {
  appUrl: string;
  adminSecret: string;
  selection: GraphQLPlaygroundSelection;
  headersTabOverrides: Record<string, unknown>;
  track: Track;
}

function trackGraphQLResponse(track: Track, payload: unknown) {
  const results = Array.isArray(payload) ? payload : [payload];

  const hasErrors = results.some((result) =>
    isNotEmptyValue((result as { errors?: unknown[] })?.errors),
  );

  if (hasErrors) {
    track('GraphQL Query Run', { outcome: 'failed' });
    return;
  }

  const hasData = results.some((result) => {
    const data = (result as { data?: Record<string, unknown> })?.data;

    return data !== null && data !== undefined;
  });

  track('GraphQL Query Run', { outcome: hasData ? 'data' : 'empty' });
}

function isCloseEvent(
  error: unknown,
): error is Pick<CloseEvent, 'code' | 'reason'> {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as CloseEvent).code === 'number' &&
    typeof (error as CloseEvent).reason === 'string'
  );
}

/**
 * graphql-ws fails a subscription with the socket's `CloseEvent`, which
 * GraphiQL prints as `{"isTrusted": true}`: its code and reason are getters.
 * They become the error's message, as GraphiQL 3's fetcher did. A hand-written
 * iterator, not an async generator: a generator queues `return()` behind a
 * pending `next()`, and stopping a subscription must not wait for its next
 * event.
 */
function withReadableCloseErrors(
  client: SubscriptionClient,
): SubscriptionClient {
  return {
    iterate(request) {
      const source = client.iterate(request);
      const iterator: ReturnType<SubscriptionClient['iterate']> = {
        next: () =>
          source.next().catch((error: unknown) => {
            if (isCloseEvent(error)) {
              throw new Error(
                `Socket closed with event ${error.code} ${error.reason}`.trim(),
              );
            }

            throw error;
          }),
        return: (value) =>
          source.return
            ? source.return(value)
            : Promise.resolve({ done: true, value }),
        [Symbol.asyncIterator]: () => iterator,
      };

      return iterator;
    },
  };
}

/**
 * The transport the playground sends requests with: the admin secret and the
 * selected user and role on every request, overridden by the Headers tab.
 */
export default function createPlaygroundTransport({
  appUrl,
  adminSecret,
  selection,
  headersTabOverrides,
  track,
}: CreatePlaygroundTransportOptions): Transport {
  let socketHeaders: Record<string, string>;

  try {
    socketHeaders = composeRequestHeaders({
      adminSecret,
      selection,
      headersTabOverrides,
    });
  } catch {
    // Header names are invalid while one is still being typed; executing a
    // query re-composes them and surfaces the rejection in the response pane.
    socketHeaders = composeRequestHeaders({ adminSecret, selection });
  }

  const transport = withRequestHeaders({
    transport: createTransport({
      url: appUrl,
      // Hasura only takes POST; listing it skips the OPTIONS discovery request.
      supportedMethods: ['POST'],
      // Response analytics cover non-incremental HTTP queries and mutations.
      // WebSocket subscriptions are returned unchanged and intentionally untracked.
      enableIncrementalDelivery: false,
      subscriptionClient: withReadableCloseErrors(
        createClient({
          url: appUrl.replace('https', 'wss').replace('http', 'ws'),
          keepAlive: 2000,
          // Subscriptions don't get per-request headers, so they must use
          // connectionParams.
          connectionParams: {
            headers: socketHeaders,
          },
        }),
      ),
    }),
    adminSecret,
    selection,
  });
  const { send } = transport;

  transport.send = (request) => {
    const result = send(request);

    if (
      request.operationName !== 'IntrospectionQuery' &&
      result instanceof Promise
    ) {
      result
        .then((response) => {
          // A body that isn't JSON (a gateway's HTML error page, an empty
          // 503) comes back as a GraphQL error, but the request never reached
          // GraphQL.
          if (!response.headers?.['content-type']?.includes('json')) {
            track('GraphQL Query Run', { outcome: 'request_error' });
            return;
          }

          trackGraphQLResponse(track, response.body);
        })
        .catch(() => {
          // Stopping a run (Run again, another tab, user or role) aborts it.
          if (request.signal?.aborted) {
            return;
          }

          track('GraphQL Query Run', { outcome: 'request_error' });
        });
    }

    return result;
  };

  return transport;
}
