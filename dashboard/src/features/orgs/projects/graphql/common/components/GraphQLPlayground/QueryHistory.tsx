import { useHistory, useHistoryActions } from '@graphiql/plugin-history';
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
import { useOpenQueryInTab } from '@/features/orgs/projects/graphql/common/hooks/useOpenQueryInTab';
import { getQueryLabel } from '@/features/orgs/projects/graphql/common/utils/getQueryLabel';
import {
  groupHistory,
  type HistoryEntry,
} from '@/features/orgs/projects/graphql/common/utils/groupHistory';
import { cn } from '@/lib/utils';

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { item, copies } = entry;
  const { toggleFavorite, deleteFromHistory } = useHistoryActions();
  const openQueryInTab = useOpenQueryInTab();
  // Named from the query itself, same as tabs: GraphiQL's saved operation
  // name can lag behind the editor.
  const label = item.label || getQueryLabel(item.query);

  return (
    <li className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent">
      <button
        type="button"
        // Headers are never restored, history doesn't keep them.
        onClick={() => openQueryInTab(item.query ?? '', item.variables)}
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
              toggleFavorite(item);
              // Older runs of the same query go, so it isn't left behind.
              for (const copy of copies.slice(1)) {
                deleteFromHistory(copy);
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
                deleteFromHistory(copy);
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

interface HistorySectionProps {
  title: string;
  // Sets the title apart from the query names below it, which are plain text
  // here (in Docs the links are colored, so the titles need no icon).
  icon: LucideIcon;
  entries: HistoryEntry[];
}

function HistorySection({ title, icon: Icon, entries }: HistorySectionProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h2
        className={cn(
          'flex items-center gap-1.5',
          PLAYGROUND_SECTION_TITLE_CLASSES,
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {title}
      </h2>
      {/* A card like the fields in Docs. Row text sits 16px from its edge. */}
      <ul className="flex flex-col rounded-md border bg-background p-2">
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

/** How many rows the History tab shows, for the count on the tab. */
export function useHistoryCount() {
  const { starred, recent } = groupHistory(useHistory());

  return starred.length + recent.length;
}

/** Whether there are recent (not starred) queries, for Clear. */
export function useHasRecentHistory() {
  return groupHistory(useHistory()).recent.length > 0;
}

/** Removes every recent query, starred ones stay. */
export function ClearRecentButton() {
  const items = useHistory();
  const { deleteFromHistory } = useHistoryActions();
  const { recent } = groupHistory(items);

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
            for (const item of items.filter((run) => !run.favorite)) {
              deleteFromHistory(item);
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
  const { starred, recent } = groupHistory(useHistory());

  if (starred.length === 0 && recent.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <span aria-hidden="true" className="flex shrink-0 text-disabled">
          <History strokeWidth={1} className="h-12 w-12" />
        </span>
        <div className="flex w-full flex-col gap-1 sm:max-w-md">
          <h3 className="font-semibold text-foreground text-lg">
            No queries yet
          </h3>
          <p className="text-muted-foreground text-sm">
            Every query you run shows up here. Star the ones you want to keep.
          </p>
        </div>
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
