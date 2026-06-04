import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ListFilter, Search, X } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { forwardRef } from 'react';

export interface LogsSearchBarProps {
  query: string;
  onQueryChange: (next: string) => void;
  totalMatches: number;
  currentMatch: number;
  filterMode: boolean;
  onToggleFilter: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
  className?: string;
}

const LogsSearchBar = forwardRef<HTMLInputElement, LogsSearchBarProps>(
  function LogsSearchBar(
    {
      query,
      onQueryChange,
      totalMatches,
      currentMatch,
      filterMode,
      onToggleFilter,
      onPrev,
      onNext,
      onClear,
      className,
    },
    ref,
  ) {
    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      onQueryChange(event.target.value);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          onPrev();
        } else {
          onNext();
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClear();
        (event.target as HTMLInputElement).blur();
      }
    }

    const counter = query
      ? totalMatches > 0
        ? `${currentMatch + 1} / ${totalMatches}`
        : '0 matches'
      : '';

    return (
      <div
        className={cn(
          'flex items-center gap-2 border-b border-divider bg-paper px-3 py-2',
          className,
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          ref={ref}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Filter logs"
          className="h-8 flex-1"
        />
        <span className="min-w-[5rem] text-right text-xs- text-muted-foreground tabular-nums">
          {counter}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={filterMode}
          className={cn('h-8 w-8', filterMode && 'bg-primary/10 text-primary')}
          onClick={onToggleFilter}
          aria-label={filterMode ? 'Show all rows' : 'Filter to matching rows'}
          title={
            filterMode
              ? 'Showing only matching rows — click to show all logs'
              : 'Highlighting matches — click to show only matching rows'
          }
        >
          <ListFilter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={totalMatches === 0}
          onClick={onPrev}
          aria-label="Previous match"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={totalMatches === 0}
          onClick={onNext}
          aria-label="Next match"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={query.length === 0}
          onClick={onClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  },
);

export default LogsSearchBar;
