import PanelTabButton from './PanelTabButton';
import RunButton from './RunButton';
import type { PlaygroundPanelTab } from './types';

interface MobilePlaygroundBarProps {
  showQuery: boolean;
  tab: PlaygroundPanelTab;
  onShowQuery: () => void;
  onShowPanel: (tab: PlaygroundPanelTab) => void;
}

/**
 * Phones only: one pane at a time, so Query joins Response, History and Docs
 * as a tab, with Run always in reach at the end.
 */
export default function MobilePlaygroundBar({
  showQuery,
  tab,
  onShowQuery,
  onShowPanel,
}: MobilePlaygroundBarProps) {
  // No History count here: a phone has no room for it.
  return (
    <div className="flex h-12 shrink-0 items-stretch justify-between gap-3 border-b px-4 md:hidden">
      <div role="tablist" className="flex min-w-0 items-stretch gap-5">
        <PanelTabButton active={showQuery} onClick={onShowQuery}>
          Query
        </PanelTabButton>
        <PanelTabButton
          active={!showQuery && tab === 'response'}
          onClick={() => onShowPanel('response')}
        >
          Response
        </PanelTabButton>
        <PanelTabButton
          active={!showQuery && tab === 'history'}
          onClick={() => onShowPanel('history')}
        >
          History
        </PanelTabButton>
        <PanelTabButton
          active={!showQuery && tab === 'docs'}
          onClick={() => onShowPanel('docs')}
        >
          Docs
        </PanelTabButton>
      </div>

      <RunButton
        className="self-center"
        onRun={() => onShowPanel('response')}
      />
    </div>
  );
}
