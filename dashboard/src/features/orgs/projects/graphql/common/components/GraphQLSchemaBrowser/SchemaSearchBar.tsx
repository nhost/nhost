import { SearchIcon, XIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { cn } from '@/lib/utils';
import type { SchemaSearchResult } from './types';

export interface SchemaSearchBarProps {
  term: string;
  /**
   * Result of the last search, or `null` if the term was not searched yet.
   */
  result: SchemaSearchResult | null;
  onTermChange: (term: string) => void;
  onFind: VoidFunction;
  onNext: VoidFunction;
  onPrevious: VoidFunction;
  className?: string;
}

function getMatchSummary({ count, index }: SchemaSearchResult) {
  if (count === 0) {
    return 'No matches';
  }

  return `${index + 1} of ${count} ${count === 1 ? 'match' : 'matches'}`;
}

export default function SchemaSearchBar({
  term,
  result,
  className,
  onTermChange,
  onFind,
  onNext,
  onPrevious,
}: SchemaSearchBarProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (!result?.count) {
      onFind();
    } else if (event.shiftKey) {
      onPrevious();
    } else {
      onNext();
    }
  };

  return (
    <search className={cn('flex items-center gap-2', className)}>
      <div className="relative max-w-xs flex-1">
        <Input
          type="search"
          aria-label="Search schema"
          value={term}
          onChange={(event) => onTermChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search fields, types, or operations..."
          className="px-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {term && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => onTermChange('')}
            className="absolute inset-y-0 right-0 rounded-l-none text-muted-foreground hover:bg-transparent"
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={onFind}
        disabled={!term.trim()}
      >
        Find
      </Button>
      {result && (
        <span
          className="whitespace-nowrap text-muted-foreground text-xs"
          aria-live="polite"
        >
          {getMatchSummary(result)}
        </span>
      )}
    </search>
  );
}
