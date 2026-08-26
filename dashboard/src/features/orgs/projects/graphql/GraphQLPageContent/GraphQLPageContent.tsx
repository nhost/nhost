import { GraphiQLProvider } from '@graphiql/react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { createClient } from 'graphql-ws';
import { useCallback, useMemo, useState } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import {
  composeRequestHeaders,
  type GraphQLPlaygroundSelection,
  withRequestHeaders,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { GraphiQLEditor } from '@/features/orgs/projects/graphql/GraphiQLEditor';
import { GraphiQLHeader } from '@/features/orgs/projects/graphql/GraphiQLHeader';
import useGraphQLPlaygroundHeaders from '@/features/orgs/projects/graphql/hooks/useGraphQLPlaygroundHeaders/useGraphQLPlaygroundHeaders';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { isNotEmptyValue } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

function reportInvalidRequestHeader(name: string) {
  triggerToast(
    `Invalid GraphQL header "${name}" was ignored. This request was sent without it.`,
  );
}

function trackGraphQLResponse(
  track: (event: string, properties?: Record<string, unknown>) => void,
  payload: unknown,
) {
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

interface GraphQLPlaygroundProps {
  adminSecret: string;
  appSubdomain: string;
  appUrl: string;
}

function GraphQLPlayground({
  adminSecret,
  appSubdomain,
  appUrl,
}: GraphQLPlaygroundProps) {
  const track = useTrackEvent();
  const [selection, setSelection] = useState<GraphQLPlaygroundSelection>({
    userId: '',
    role: '',
  });
  const { headerText, headersTabOverrides, setHeaderText } =
    useGraphQLPlaygroundHeaders(appSubdomain);
  const handleSelectionChange = useCallback(
    (nextSelection: GraphQLPlaygroundSelection) => {
      setSelection(nextSelection);
    },
    [],
  );
  const fetcher = useMemo(() => {
    const subscriptionUrl = appUrl
      .replace('https', 'wss')
      .replace('http', 'ws');
    const socketHeaders = composeRequestHeaders({
      adminSecret,
      selection,
      headersTabOverrides,
    });
    const baseFetcher = createGraphiQLFetcher({
      url: appUrl,
      enableIncrementalDelivery: false,
      wsClient: createClient({
        url: subscriptionUrl,
        keepAlive: 2000,
        connectionParams: {
          headers: socketHeaders,
        },
      }),
    });
    const requestFetcher = withRequestHeaders({
      fetcher: baseFetcher,
      adminSecret,
      selection,
      onInvalidHeader: reportInvalidRequestHeader,
    });
    const trackedFetcher: typeof baseFetcher = (graphQLParams, fetcherOpts) => {
      const result = requestFetcher(graphQLParams, fetcherOpts);

      if (
        graphQLParams.operationName !== 'IntrospectionQuery' &&
        result instanceof Promise
      ) {
        result
          .then((payload) => trackGraphQLResponse(track, payload))
          .catch(() =>
            track('GraphQL Query Run', { outcome: 'request_error' }),
          );
      }

      return result;
    };

    return trackedFetcher;
  }, [adminSecret, appUrl, headersTabOverrides, selection, track]);

  return (
    <GraphiQLProvider
      fetcher={fetcher}
      headers={headerText}
      shouldPersistHeaders={false}
    >
      <GraphiQLHeader onSelectionChange={handleSelectionChange} />
      <GraphiQLEditor onEditHeaders={setHeaderText} />
    </GraphiQLProvider>
  );
}

export default function GraphQLPageContent() {
  const { project } = useProject();

  if (!project?.subdomain || !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  const appUrl = generateAppServiceUrl(
    project.subdomain,
    project.region,
    'graphql',
  );

  return (
    <GraphQLPlayground
      key={project.subdomain}
      adminSecret={project.config.hasura.adminSecret}
      appSubdomain={project.subdomain}
      appUrl={appUrl}
    />
  );
}
