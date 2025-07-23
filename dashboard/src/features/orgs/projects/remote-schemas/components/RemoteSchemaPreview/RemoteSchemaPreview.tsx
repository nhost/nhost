import { Input } from '@/components/ui/v2/Input';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { Search, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import useIntrospectRemoteSchemaQuery from '../../hooks/useIntrospectRemoteSchemaQuery/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '../../utils/convertIntrospectionToSchema';
import { RemoteSchemaTree } from './RemoteSchemaTree';
import type { RelationshipFields } from './types';

export interface RemoteSchemaPreviewProps {
  name: string;
}

export const RemoteSchemaPreview = ({ name }: RemoteSchemaPreviewProps) => {
  const {
    data: introspectionData,
    isLoading,
    error,
  } = useIntrospectRemoteSchemaQuery(name);
  const treeRef = useRef<RemoteSchemaTreeRef>(null);

  const [relationshipFields, setRelationshipFields] = useState<
    RelationshipFields[]
  >([
    {
      key: '__query',
      depth: 0,
      checkable: false,
      argValue: null,
      type: 'field',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const schema = useMemo(() => {
    if (introspectionData) {
      return convertIntrospectionToSchema(introspectionData);
    }
    return null;
  }, [introspectionData]);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!searchTerm.trim() || !treeRef.current) return;

      setIsSearching(true);
      setSearchMessage('');

      try {
        const path = await treeRef.current.findItemPath(searchTerm);

        if (path && path.length > 0) {
          // Expand tree to show the found item
          await treeRef.current.expandToItem(path);

          // Focus and select the found item
          const foundItemId = path[path.length - 1];
          treeRef.current.selectItems([foundItemId]);
          treeRef.current.focusItem(foundItemId);

          setSearchMessage(`Found and highlighted: ${searchTerm}`);

          // Clear the success message after 3 seconds
          setTimeout(() => setSearchMessage(''), 3000);
        } else {
          setSearchMessage(`No results found for: ${searchTerm}`);
          // Clear the error message after 5 seconds
          setTimeout(() => setSearchMessage(''), 5000);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchMessage('Search failed. Please try again.');
        setTimeout(() => setSearchMessage(''), 5000);
      } finally {
        setIsSearching(false);
      }
    },
    [searchTerm],
  );

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchMessage('');
    treeRef.current?.focusTree();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      } else if (e.key === 'Escape') {
        handleClearSearch();
      }
    },
    [handleSearch, handleClearSearch],
  );

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
          Error introspecting remote schema:{' '}
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
    <div className="rounded-lg border">
      <div className="border-b bg-muted/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Schema Preview</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse the GraphQL schema structure
            </p>
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex w-full gap-2">
          <div className="relative flex w-full flex-1 flex-row items-center">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              fullWidth
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search fields, types, or operations..."
              className="max-w-72 pl-4"
              disabled={isSearching}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 transform text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={!searchTerm.trim() || isSearching}
            loading={isSearching}
          >
            {isSearching ? 'Searching...' : 'Find'}
          </Button>
        </form>

        {/* Search Message */}
        {/* {searchMessage && (
          <Alert
            severity={searchMessage.includes('Found') ? 'success' : 'warning'}
            className="mt-2"
          >
            {searchMessage}
          </Alert>
        )} */}
      </div>

      <div className="p-4">
        <RemoteSchemaTree
          ref={treeRef}
          className="min-h-[400px]"
          checkable={false}
          schema={schema}
          fields={['query']}
          relationshipFields={relationshipFields}
          setRelationshipFields={setRelationshipFields}
          rootFields={['query', 'mutation', 'subscription']}
        />
      </div>
    </div>
  );
};
