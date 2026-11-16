import { ChevronDown, ChevronUp, ListFilter, Search, X } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { forwardRef } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { cn } from '@/lib/utils';

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

const ForwardedLogsSearchBar = forwardRef<HTMLInputElement, LogsSearchBarProps>(
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
          'flex items-center gap-2 border-divider border-b px-3 py-2',
          className,
        )}
      >
        <InputGroup className="w-full max-w-xs bg-transparent dark:bg-transparent">
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            ref={ref}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Filter logs"
          />
        </InputGroup>
        <span className="min-w-[5rem] text-right text-muted-foreground text-xs- tabular-nums">
          {counter}
        </span>
        <Button
          type="button"
          variant="subtle"
          size="icon"
          aria-pressed={filterMode}
          className={cn(
            filterMode && 'bg-primary/10 text-primary dark:text-primary',
          )}
          onClick={onToggleFilter}
          aria-label={filterMode ? 'Show all rows' : 'Filter to matching rows'}
          title={
            filterMode
              ? 'Showing only matching rows — click to show all logs'
              : 'Highlighting matches — click to show only matching rows'
          }
        >
          <ListFilter />
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="icon"
          disabled={totalMatches === 0}
          onClick={onPrev}
          aria-label="Previous match"
        >
          <ChevronUp />
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="icon"
          disabled={totalMatches === 0}
          onClick={onNext}
          aria-label="Next match"
        >
          <ChevronDown />
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="icon"
          disabled={query.length === 0}
          onClick={onClear}
          aria-label="Clear search"
        >
          <X />
        </Button>
      </div>
    );
  },
);

export default ForwardedLogsSearchBar;
