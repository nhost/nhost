import {
  PlusIcon,
  pick,
  Tab,
  Tabs,
  UnStyledButton,
  useGraphiQL,
  useGraphiQLActions,
} from '@graphiql/react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

// GraphiQL's title for a tab whose query has no operation name, empty ones
// included.
const UNTITLED = '<untitled>';

/**
 * The query tabs, with the plus right after the last one. Each is named by
 * GraphiQL after its operation; one without a name is a new query.
 */
export default function SessionTabs() {
  const { tabs, activeTabIndex } = useGraphiQL(pick('tabs', 'activeTabIndex'));
  const { addTab, changeTab, closeTab, moveTab, stop } = useGraphiQLActions();
  const hasMultipleTabs = tabs.length > 1;

  // GraphiQL's addTab keeps the run going, and its responses would land in
  // the new tab: stop it, as opening any other tab does.
  function handleAddTab() {
    stop();
    addTab();
  }

  return (
    <div className="flex shrink-0 items-center gap-2 px-4">
      {/* GraphiQL's own tab bar hides the strip's scrollbar the same way. */}
      <Tabs
        values={tabs}
        onReorder={moveTab}
        aria-label="Queries"
        className="no-scrollbar"
      >
        {tabs.map((tab, index) => (
          <Tab key={tab.id} value={tab} isActive={index === activeTabIndex}>
            <Tab.Button
              aria-controls="graphiql-session"
              id={`graphiql-session-tab-${index}`}
              // Stops a run only when another tab opens: clicking the open
              // one keeps its query or subscription running.
              onClick={() => changeTab(index)}
            >
              {tab.title === UNTITLED ? 'New query' : tab.title}
            </Tab.Button>

            {hasMultipleTabs && <Tab.Close onClick={() => closeTab(index)} />}
          </Tab>
        ))}
      </Tabs>

      <Tooltip>
        <TooltipTrigger asChild>
          <UnStyledButton
            type="button"
            className="graphiql-tab-add"
            onClick={handleAddTab}
            aria-label="Add tab"
          >
            <PlusIcon aria-hidden="true" />
          </UnStyledButton>
        </TooltipTrigger>
        <TooltipContent side="top">Add tab</TooltipContent>
      </Tooltip>
    </div>
  );
}
