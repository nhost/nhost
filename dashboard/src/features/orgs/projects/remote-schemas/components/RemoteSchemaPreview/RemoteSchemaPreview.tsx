import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import useIntrospectRemoteSchemaQuery from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { SearchIcon, XIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RemoteSchemaTreeRef } from './RemoteSchemaTree';
import { RemoteSchemaTree } from './RemoteSchemaTree';

export interface RemoteSchemaPreviewProps {
  name: string;
}

export default function RemoteSchemaPreview({
  name,
}: RemoteSchemaPreviewProps) {
  const {
    data: introspectionData,
    isLoading,
    error,
  } = useIntrospectRemoteSchemaQuery(name);
  const treeRef = useRef<RemoteSchemaTreeRef>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<string[][]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const schema = useMemo(() => {
    if (introspectionData) {
      return convertIntrospectionToSchema(introspectionData);
    }
    return null;
  }, [introspectionData]);

  const navigateToMatch = async (paths: string[][], index: number) => {
    if (!treeRef.current || paths.length === 0) {
      return;
    }

    const path = paths[index];
    await treeRef.current.expandToItem(path);
    const foundItemId = path[path.length - 1];
    treeRef.current.selectItems([foundItemId]);
    treeRef.current.focusItem(foundItemId);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!searchTerm.trim() || !treeRef.current) {
      return;
    }

    setIsSearching(true);

    try {
      const allPaths = treeRef.current.findAllItemPaths(searchTerm);
      setMatches(allPaths);
      setHasSearched(true);
      if (allPaths.length > 0) {
        setMatchIndex(0);
        await navigateToMatch(allPaths, 0);
      }
    } catch (searchError) {
      console.error('Search error:', searchError);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchTerm.trim()) {
        return;
      }
      if (matches.length > 0) {
        const step = e.shiftKey ? -1 : 1;
        const nextIndex = (matchIndex + step + matches.length) % matches.length;
        setMatchIndex(nextIndex);
        navigateToMatch(matches, nextIndex);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setMatches([]);
      setMatchIndex(0);
      setHasSearched(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTree =
        treeContainerRef.current?.contains(target as Node) ?? false;
      const isSearchInput = target === searchInputRef.current;

      if (e.key === 'Enter' && searchTerm.trim() && inTree && !isSearchInput) {
        e.preventDefault();
        e.stopPropagation();
        if (matches.length > 0) {
          const step = e.shiftKey ? -1 : 1;
          const nextIndex =
            (matchIndex + step + matches.length) % matches.length;
          setMatchIndex(nextIndex);
          navigateToMatch(matches, nextIndex);
        } else if (treeRef.current) {
          const allPaths = treeRef.current.findAllItemPaths(searchTerm);
          setMatches(allPaths);
          setHasSearched(true);
          if (allPaths.length > 0) {
            const startIndex = e.shiftKey ? allPaths.length - 1 : 0;
            setMatchIndex(startIndex);
            navigateToMatch(allPaths, startIndex);
          }
        }
      }

      if (e.key === 'Escape' && inTree && !isSearchInput) {
        e.preventDefault();
        e.stopPropagation();
        setSearchTerm('');
        setMatches([]);
        setMatchIndex(0);
        setHasSearched(false);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [searchTerm, matches, matchIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading schema...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-red-600">
          Error introspecting:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">
          No schema data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Schema Preview</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse the GraphQL schema structure
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex w-full gap-2">
          <div className="relative max-w-xs flex-1 text-foreground">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 text-muted-foreground peer-disabled:opacity-50">
              <SearchIcon className="z-10 h-4 w-4" />
              <span className="sr-only">Search</span>
            </div>
            <Input
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setMatches([]);
                setMatchIndex(0);
                setHasSearched(false);
              }}
              onKeyDown={handleKeyDown}
              ref={searchInputRef}
              disabled={isSearching}
              placeholder="Search fields, types, or operations..."
              className="peer px-9 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchTerm('');
                  setMatches([]);
                  setMatchIndex(0);
                }}
                className="absolute inset-y-0 right-0 rounded-l-none text-muted-foreground hover:bg-transparent focus-visible:ring-ring/50"
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Clear input</span>
              </Button>
            )}
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!searchTerm.trim() || isSearching}
            loading={isSearching}
          >
            {isSearching ? 'Searching...' : 'Find'}
          </Button>
          {hasSearched && (
            <span className="flex items-center text-xs text-muted-foreground">
              {matches.length}{' '}
              {matches.length === 1 ? 'occurrence' : 'occurrences'} found
            </span>
          )}
        </form>
      </div>

      <div className="p-4" ref={treeContainerRef}>
        <RemoteSchemaTree
          ref={treeRef}
          className="min-h-[400px]"
          schema={schema}
          highlightTerm={searchTerm}
        />
      </div>
    </div>
  );
}
