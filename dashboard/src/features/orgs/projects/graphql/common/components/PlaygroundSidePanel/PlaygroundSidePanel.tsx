import {
  DocExplorer,
  type GraphiQLPlugin,
  useExplorerContext,
  usePluginContext,
} from '@graphiql/react';
import { BookOpen, History } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import {
  ClearRecentButton,
  QueryHistory,
} from '@/features/orgs/projects/graphql/common/components/QueryHistory';
import { cn } from '@/lib/utils';
import SchemaTypeGroups from './SchemaTypeGroups';

type PanelTab = 'history' | 'docs';

// GraphiQL registers its own History and Documentation Explorer plugins, so
// ours need other titles. Both are opened from the playground header and
// share one outlined pane with History and Docs tabs.
const HISTORY_TITLE = 'Query history';
const DOCS_TITLE = 'Schema docs';

function PanelTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      // Same look as the Variables and Headers tabs. GraphiQL's stylesheet
      // colors every button inside it, hence the important colors.
      className={cn(
        'hover:!text-primary h-full border-b-2 font-semibold text-sm transition-colors',
        active
          ? '!text-primary border-primary'
          : '!text-muted-foreground border-transparent',
      )}
    >
      {children}
    </button>
  );
}

// GraphiQL's docs, with our grouped type list on the start page.
function DocsTab() {
  const explorer = useExplorerContext();
  const isStartPage = (explorer?.explorerNavStack.length ?? 1) === 1;

  return (
    <>
      <DocExplorer />
      {isStartPage && <SchemaTypeGroups />}
    </>
  );
}

/**
 * The side panel next to the editors: an outlined pane like Query and
 * Response, with History and Docs as tabs.
 */
function SidePanel({ tab }: { tab: PanelTab }) {
  const pluginContext = usePluginContext();
  const showTab = (title: string) => pluginContext?.setVisiblePlugin(title);
  const panelRef = useRef<HTMLDivElement>(null);

  // GraphiQL's docs search only says "⌘ K", which is also the dashboard's
  // command palette shortcut. It has no prop for it and rebuilds the field
  // whenever you open a type, so the placeholder is set again each time.
  useEffect(() => {
    const panel = panelRef.current;

    if (tab !== 'docs' || !panel) {
      return undefined;
    }

    const renameSearch = () => {
      const input = panel.querySelector<HTMLInputElement>(
        '.graphiql-doc-explorer-search [role="combobox"]',
      );

      if (input && input.placeholder !== 'Search the schema') {
        input.placeholder = 'Search the schema';
      }
    };

    renameSearch();

    const observer = new MutationObserver(renameSearch);
    observer.observe(panel, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [tab]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border">
      <div className="flex h-12 shrink-0 items-stretch justify-between border-b pr-2 pl-4">
        <div role="tablist" className="flex items-stretch gap-6">
          <PanelTabButton
            active={tab === 'history'}
            onClick={() => showTab(HISTORY_TITLE)}
          >
            History
          </PanelTabButton>
          <PanelTabButton
            active={tab === 'docs'}
            onClick={() => showTab(DOCS_TITLE)}
          >
            Docs
          </PanelTabButton>
        </div>

        {tab === 'history' && (
          <div className="flex items-center">
            <ClearRecentButton />
          </div>
        )}
      </div>

      <div
        ref={panelRef}
        role="tabpanel"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          tab === 'history' ? 'px-2 pt-4 pb-2' : 'playground-docs p-4',
        )}
      >
        {tab === 'history' ? <QueryHistory /> : <DocsTab />}
      </div>
    </div>
  );
}

export const HISTORY_PANEL_PLUGIN: GraphiQLPlugin = {
  title: HISTORY_TITLE,
  icon: History,
  content: () => <SidePanel tab="history" />,
};

export const DOCS_PANEL_PLUGIN: GraphiQLPlugin = {
  title: DOCS_TITLE,
  icon: BookOpen,
  content: () => <SidePanel tab="docs" />,
};
