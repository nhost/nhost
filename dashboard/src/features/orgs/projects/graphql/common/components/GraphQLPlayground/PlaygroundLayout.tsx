import {
  PortalProvider,
  Tooltip,
  tryParseJSONC,
  useGraphiQLSettings,
} from '@graphiql/react';
import debounce from 'lodash.debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClearStaleResponses } from '@/features/orgs/projects/graphql/common/hooks/useClearStaleResponses';
import { useDocExplorerSync } from '@/features/orgs/projects/graphql/common/hooks/useDocExplorerSync';
import { useEditorFont } from '@/features/orgs/projects/graphql/common/hooks/useEditorFont';
import { useOnRun } from '@/features/orgs/projects/graphql/common/hooks/useOnRun';
import { useSplitPanes } from '@/features/orgs/projects/graphql/common/hooks/useSplitPanes';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { cn } from '@/lib/utils';
import { useThemePreference } from '@/providers/Theme';
import DividerGrip from './DividerGrip';
import MobilePlaygroundBar from './MobilePlaygroundBar';
import PlaygroundHeader from './PlaygroundHeader';
import QueryPane from './QueryPane';
import ResponsePane from './ResponsePane';
import SessionTabs from './SessionTabs';
import type { PlaygroundPanelTab, PlaygroundRequest } from './types';

// Neither pane can be dragged narrower than this: the `md:min-w-80` class on
// both keeps them at it when the window narrows.
const MIN_PANE_WIDTH = 320;

interface PlaygroundLayoutProps {
  request: PlaygroundRequest;
  /** Called when the user or role changes. */
  onSelectionChange: (selection: GraphQLPlaygroundSelection) => void;
  /** Called with the parsed Headers tab once it holds a valid object. */
  onHeaderChange: (headers: Record<string, unknown>) => void;
}

/**
 * The playground's panes: the query on the left, and on the right the
 * response, history and docs as tabs. Must be inside `GraphiQLProvider`.
 */
export default function PlaygroundLayout({
  request,
  onSelectionChange,
  onHeaderChange,
}: PlaygroundLayoutProps) {
  useDocExplorerSync();
  useClearStaleResponses(request.selection);

  const [tab, setTab] = useState<PlaygroundPanelTab>('response');
  // On a phone only one pane fits: the query, or the response pane on its
  // Response, History or Docs tab. Desktop shows both and ignores this.
  const [showQuery, setShowQuery] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  useEditorFont(containerRef);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const { resolvedTheme } = useThemePreference();
  // Puts GraphiQL's theme on the container and on the Monaco editors.
  const { theme, setTheme } = useGraphiQLSettings(containerRef);
  const panes = useSplitPanes({
    storageKey: 'playgroundSplit',
    minPaneWidth: MIN_PANE_WIDTH,
  });

  // GraphiQL follows the dashboard's theme. globals.css maps the main colors
  // from the dashboard's own theme class; this covers the Monaco editors and
  // the colors it doesn't map.
  useEffect(() => {
    if (theme !== resolvedTheme) {
      setTheme(resolvedTheme);
    }
  }, [resolvedTheme, setTheme, theme]);

  function showPanel(nextTab: PlaygroundPanelTab) {
    setTab(nextTab);
    setShowQuery(false);
  }

  // A run shows its response, whichever tab was open, also when GraphiQL
  // refuses to send it.
  const showResponse = useCallback(() => {
    setTab('response');
    setShowQuery(false);
  }, []);

  useOnRun(showResponse);

  const handleEditHeaders = useMemo(
    () =>
      debounce((headers: string) => {
        try {
          onHeaderChange(tryParseJSONC(headers) ?? {});
        } catch {
          // Not valid yet (e.g. while typing): keep the last valid headers.
        }
      }, 200),
    [onHeaderChange],
  );

  useEffect(() => () => handleEditHeaders.cancel(), [handleEditHeaders]);

  return (
    <Tooltip.Provider>
      <PortalProvider container={portalContainer}>
        <div
          ref={(node) => {
            containerRef.current = node;
            setPortalContainer(node);
          }}
          className="graphiql-container flex flex-col"
        >
          <PlaygroundHeader onSelectionChange={onSelectionChange} />

          <MobilePlaygroundBar
            showQuery={showQuery}
            tab={tab}
            onShowQuery={() => setShowQuery(true)}
            onShowPanel={showPanel}
          />

          <SessionTabs />

          {/* On a phone the shown pane takes the whole width, over the sizes
              the divider sets inline. */}
          <div className="flex min-h-0 flex-1 px-4 pt-2 pb-4">
            <div
              ref={panes.firstRef}
              style={panes.firstStyle}
              className={cn(
                'max-md:!flex-[1_1_100%] min-w-0 md:min-w-80',
                !showQuery && 'max-md:hidden',
              )}
            >
              <QueryPane
                request={request}
                onEditHeaders={handleEditHeaders}
                onOpenDocs={() => showPanel('docs')}
                onRun={showResponse}
              />
            </div>

            <div
              {...panes.dividerProps}
              aria-hidden="true"
              className="playground-divider playground-divider-x hidden w-4 shrink-0 cursor-col-resize md:block"
            >
              <DividerGrip />
            </div>

            <div
              ref={panes.secondRef}
              style={panes.secondStyle}
              className={cn(
                'max-md:!flex-[1_1_100%] min-w-0 md:min-w-80',
                showQuery && 'max-md:hidden',
              )}
            >
              <ResponsePane tab={tab} onTabChange={setTab} />
            </div>
          </div>
        </div>
      </PortalProvider>
    </Tooltip.Provider>
  );
}
