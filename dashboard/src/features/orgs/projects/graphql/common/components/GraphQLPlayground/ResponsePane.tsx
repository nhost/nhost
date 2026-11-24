import { pick, ResponseEditor, useGraphiQL } from '@graphiql/react';
import { Braces } from 'lucide-react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { cn } from '@/lib/utils';
import PanelTabButton from './PanelTabButton';
import PlaygroundDocs from './PlaygroundDocs';
import QueryHistory, {
  ClearRecentButton,
  useHasRecentHistory,
  useHistoryCount,
} from './QueryHistory';
import ResponseStatus, { useResponseDescription } from './ResponseStatus';
import type { PlaygroundPanelTab } from './types';

interface ResponsePaneProps {
  tab: PlaygroundPanelTab;
  onTabChange: (tab: PlaygroundPanelTab) => void;
}

/**
 * Response, History and Docs share this pane as tabs. All three stay mounted,
 * so switching back keeps where you were.
 */
export default function ResponsePane({ tab, onTabChange }: ResponsePaneProps) {
  const { tabs, activeTabIndex, isFetching, fetchError, validationErrors } =
    useGraphiQL(
      pick(
        'tabs',
        'activeTabIndex',
        'isFetching',
        'fetchError',
        'validationErrors',
      ),
    );
  const hasRecent = useHasRecentHistory();
  // Each query tab keeps its own response.
  const responseText = tabs[activeTabIndex]?.response;
  // A failed schema fetch is written to the editor, not to the tab's response.
  const isEmpty =
    !responseText &&
    !isFetching &&
    !fetchError &&
    validationErrors.length === 0;
  const historyCount = useHistoryCount();
  const status = useResponseDescription();
  const showClear = tab === 'history' && hasRecent;
  const showStatus = tab === 'response' && status !== null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-muted">
      {/* On phones the tabs are in the bar above the panes, so this row only
          shows there for the status or Clear. */}
      <div
        className={cn(
          'h-12 shrink-0 items-stretch justify-between gap-4 border-b pr-2 pl-4 md:flex',
          showClear || showStatus ? 'flex' : 'hidden',
        )}
      >
        <div
          role="tablist"
          className="hidden min-w-0 items-stretch gap-6 md:flex"
        >
          <PanelTabButton
            active={tab === 'response'}
            onClick={() => onTabChange('response')}
          >
            Response
          </PanelTabButton>
          <PanelTabButton
            active={tab === 'history'}
            onClick={() => onTabChange('history')}
          >
            History
            {historyCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 font-medium text-primary text-xs leading-5">
                {historyCount}
              </span>
            )}
          </PanelTabButton>
          <PanelTabButton
            active={tab === 'docs'}
            onClick={() => onTabChange('docs')}
          >
            Docs
          </PanelTabButton>
        </div>

        {showClear && (
          <div className="ml-auto flex items-center">
            <ClearRecentButton />
          </div>
        )}

        {tab === 'response' && (
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {status && <ResponseStatus description={status} />}
            {responseText && (
              <span className="hidden md:inline-flex">
                <CopyToClipboardButton
                  textToCopy={responseText}
                  title="Response"
                />
              </span>
            )}
          </div>
        )}
      </div>

      <div
        role="tabpanel"
        className={cn(
          // The status and copy are in the row above, so GraphiQL's own bar
          // for them doesn't show.
          'relative min-h-0 flex-1 [&_.graphiql-response-header]:hidden',
          tab !== 'response' && 'hidden',
        )}
      >
        <ResponseEditor />

        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 py-16 text-center">
            <span aria-hidden="true" className="flex shrink-0 text-disabled">
              <Braces strokeWidth={1} className="h-12 w-12" />
            </span>
            <div className="flex w-full flex-col gap-1 sm:max-w-md">
              <h3 className="font-semibold text-foreground text-lg">
                No response yet
              </h3>
              <p className="text-muted-foreground text-sm">
                Run a query to see the response.
              </p>
            </div>
          </div>
        )}
      </div>
      <div
        role="tabpanel"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto p-4',
          tab !== 'history' && 'hidden',
        )}
      >
        <QueryHistory />
      </div>
      <div
        role="tabpanel"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          tab !== 'docs' && 'hidden',
        )}
      >
        <PlaygroundDocs />
      </div>
    </div>
  );
}
