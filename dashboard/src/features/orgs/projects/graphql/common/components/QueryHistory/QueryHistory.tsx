import {
  useEditorContext,
  useExecutionContext,
  useHistoryContext,
} from '@graphiql/react';
import {
  Clock,
  History,
  ListX,
  type LucideIcon,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  PLAYGROUND_ICON_BUTTON_CLASSES,
  PLAYGROUND_SECTION_TITLE_CLASSES,
} from '@/features/orgs/projects/graphql/common/constants/playground';
import { getQueryLabel } from '@/features/orgs/projects/graphql/common/utils/getQueryLabel';
import {
  groupHistory,
  type HistoryEntry,
} from '@/features/orgs/projects/graphql/common/utils/groupHistory';
import { cn } from '@/lib/utils';

const sameQuery = (
  a: string | null | undefined,
  b: string | null | undefined,
) => (a ?? '').trim() === (b ?? '').trim();

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { item, copies } = entry;
  const history = useHistoryContext({ nonNull: true });
  const editorContext = useEditorContext({ nonNull: true });
  const executionContext = useExecutionContext({ nonNull: true });
  // Named from the query itself, same as tabs: GraphiQL's saved operation
  // name can lag behind the editor.
  const label = item.label || getQueryLabel(item.query);

  // Opens the query without touching the tab you're on: an open tab with the
  // same query becomes active, otherwise it opens in a new tab. Headers are
  // never restored, history doesn't keep them.
  function openItem() {
    const openTabIndex = editorContext.tabs.findIndex((tab) =>
      sameQuery(tab.query, item.query),
    );

    executionContext.stop();

    if (openTabIndex !== -1) {
      editorContext.changeTab(openTabIndex);
      return;
    }

    editorContext.addTab();

    // The new tab clears the editors first, so fill them right after.
    setTimeout(() => {
      editorContext.queryEditor?.setValue(item.query ?? '');
      editorContext.variableEditor?.setValue(item.variables ?? '');
    }, 0);
  }

  return (
    <li className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent">
      <button
        type="button"
        onClick={openItem}
        className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-foreground text-sm"
      >
        {label}
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="subtle"
            size="icon-xs"
            aria-label={item.favorite ? `Unstar ${label}` : `Star ${label}`}
            aria-pressed={!!item.favorite}
            onClick={() => {
              history.toggleFavorite(item);
              // Older runs of the same query go, so it isn't left behind.
              for (const copy of copies.slice(1)) {
                history.deleteFromHistory(copy);
              }
            }}
            className={cn(
              'shrink-0',
              !item.favorite &&
                'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
            )}
          >
            <Star
              className={cn(
                'size-3.5',
                item.favorite
                  ? 'fill-primary text-primary'
                  : 'text-muted-foreground',
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {item.favorite ? 'Unstar' : 'Star to keep it on top'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="subtle"
            size="icon-xs"
            aria-label={`Delete ${label}`}
            onClick={() => {
              for (const copy of copies) {
                history.deleteFromHistory(copy);
              }
            }}
            className="shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete</TooltipContent>
      </Tooltip>
    </li>
  );
}

function HistorySection({
  title,
  icon: Icon,
  entries,
}: {
  title: string;
  // Sets the title apart from the query names below it, which are plain text
  // here (in Docs the links are colored, so the titles need no icon).
  icon: LucideIcon;
  entries: HistoryEntry[];
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-1">
      <h2
        className={cn(
          'flex items-center gap-1.5 px-2',
          PLAYGROUND_SECTION_TITLE_CLASSES,
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {title}
      </h2>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <HistoryRow
            key={`${entry.item.favorite ? 'starred' : 'recent'}-${entry.item.query}-${entry.item.variables}`}
            entry={entry}
          />
        ))}
      </ul>
    </section>
  );
}

// The history rows, newest first, split into starred and recent, each query
// once.
function useHistoryLists() {
  const history = useHistoryContext({ nonNull: true });

  return { history, ...groupHistory(history.items) };
}

/** How many rows the History panel shows, for the count on its button. */
export function useHistoryCount() {
  const history = useHistoryContext();
  const { starred, recent } = groupHistory(history?.items ?? []);

  return starred.length + recent.length;
}

/**
 * Removes every recent query, starred ones stay. Shown in the side panel's
 * title bar while there is something to clear.
 */
export function ClearRecentButton() {
  const { history, recent } = useHistoryLists();

  if (recent.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          size="icon"
          aria-label="Clear recent queries"
          onClick={() => {
            for (const item of history.items.filter((run) => !run.favorite)) {
              history.deleteFromHistory(item);
            }
          }}
          className={PLAYGROUND_ICON_BUTTON_CLASSES}
        >
          <ListX className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Clear recent (starred stay)</TooltipContent>
    </Tooltip>
  );
}

/**
 * The playground's history: starred queries on top, then recent runs,
 * newest first. Saved per project in the browser, without headers.
 */
export default function QueryHistory() {
  const { starred, recent } = useHistoryLists();

  if (starred.length === 0 && recent.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <History
          strokeWidth={1}
          aria-hidden="true"
          className="size-10 text-disabled"
        />
        <p className="font-medium text-foreground text-sm">No queries yet</p>
        <p className="text-muted-foreground text-sm">
          Every query you run shows up here. Star the ones you want to keep.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <HistorySection title="Starred" icon={Star} entries={starred} />
      <HistorySection title="Recent" icon={Clock} entries={recent} />
    </div>
  );
}
