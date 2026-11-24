import { DOC_EXPLORER_PLUGIN } from '@graphiql/plugin-doc-explorer';
import { HistoryStore } from '@graphiql/plugin-history';
import { GraphiQLProvider } from '@graphiql/react';
import 'graphiql/setup-workers/webpack';
// graphiql/style.css without what the playground doesn't show: the Roboto and
// Fira Code fonts (the dashboard's fonts replace them) and the styles of the
// plugins it doesn't use. Monaco's styles come with Monaco's own modules.
import '@graphiql/react/style.css';
import '@graphiql/plugin-doc-explorer/style.css';
import 'graphiql/graphiql.css';
import { dequal } from 'dequal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { createPlaygroundTransport } from '@/features/orgs/projects/graphql/common/utils/createPlaygroundTransport';
import {
  createPlaygroundStorage,
  removeSharedPlaygroundStorage,
} from '@/features/orgs/projects/graphql/common/utils/playgroundStorage';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import PlaygroundLayout from './PlaygroundLayout';

/**
 * The project's GraphQL playground. Client only: Monaco needs the browser.
 */
export default function GraphQLPlayground() {
  const { project } = useProject();
  const track = useTrackEvent();
  // What the user picker reports first (Admin, whose first role is always
  // admin), so its first report doesn't rebuild the transport.
  const [selection, setSelection] = useState<GraphQLPlaygroundSelection>({
    userId: '',
    role: 'admin',
  });
  const [headersTabOverrides, setHeadersTabOverrides] = useState<
    Record<string, unknown>
  >({});
  // The user picker reports a selection again when nothing changed (the same
  // role picked, its user list loading), and switching query tabs rewrites
  // the Headers editor, often with the same headers. Only a real change may
  // rebuild the transport: each new one fetches the schema again.
  const handleSelectionChange = useCallback(
    (nextSelection: GraphQLPlaygroundSelection) => {
      setSelection((currentSelection) =>
        dequal(currentSelection, nextSelection)
          ? currentSelection
          : nextSelection,
      );
    },
    [],
  );
  const handleHeaderChange = useCallback(
    (nextOverrides: Record<string, unknown>) => {
      setHeadersTabOverrides((overrides) =>
        dequal(overrides, nextOverrides) ? overrides : nextOverrides,
      );
    },
    [],
  );
  // Tabs, history and starred queries are kept per project, without request
  // headers.
  const projectId = project?.id;
  const storage = useMemo(
    () => (projectId ? createPlaygroundStorage(projectId) : undefined),
    [projectId],
  );

  useEffect(() => {
    removeSharedPlaygroundStorage();
  }, []);

  const subdomain = project?.subdomain;
  const region = project?.region;
  const adminSecret = project?.config?.hasura.adminSecret;
  const endpoint =
    subdomain && region
      ? generateAppServiceUrl(subdomain, region, 'graphql')
      : null;
  // Rebuilt only when what it sends changes: each new transport fetches the
  // schema again.
  const transport = useMemo(
    () =>
      endpoint && adminSecret
        ? createPlaygroundTransport({
            appUrl: endpoint,
            adminSecret,
            selection,
            headersTabOverrides,
            track,
          })
        : null,
    [endpoint, adminSecret, selection, headersTabOverrides, track],
  );

  if (!transport || !endpoint || !adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <GraphiQLProvider
      // GraphiQL reads its storage once: another project starts afresh.
      key={projectId}
      transport={transport}
      storage={storage}
      // Turns on Ctrl+click in the editor. The docs are our own tab, so no
      // plugin is registered to show them.
      referencePlugin={DOC_EXPLORER_PLUGIN}
    >
      <HistoryStore>
        <PlaygroundLayout
          request={{ endpoint, adminSecret, selection, headersTabOverrides }}
          onSelectionChange={handleSelectionChange}
          onHeaderChange={handleHeaderChange}
        />
      </HistoryStore>
    </GraphiQLProvider>
  );
}
