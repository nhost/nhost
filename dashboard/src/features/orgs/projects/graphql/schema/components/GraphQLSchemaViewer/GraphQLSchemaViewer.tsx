import { buildClientSchema, printSchema } from 'graphql';
import { useMemo, useRef, useState } from 'react';
import {
  StickyHeaderCard,
  StickyHeaderCardContent,
  StickyHeaderCardHeader,
} from '@/components/layout/StickyHeaderCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import {
  GraphQLSchemaBrowser,
  SchemaSearchBar,
  type SchemaSearchHandle,
  type SchemaSearchResult,
} from '@/features/orgs/projects/graphql/common/components/GraphQLSchemaBrowser';
import { SchemaRoleSelect } from '@/features/orgs/projects/graphql/schema/components/SchemaRoleSelect';
import { SchemaSdlView } from '@/features/orgs/projects/graphql/schema/components/SchemaSdlView';
import {
  type SchemaView,
  SchemaViewToggle,
} from '@/features/orgs/projects/graphql/schema/components/SchemaViewToggle';
import { useIntrospectGraphQLSchemaQuery } from '@/features/orgs/projects/graphql/schema/hooks/useIntrospectGraphQLSchemaQuery';

export default function GraphQLSchemaViewer() {
  const [role, setRole] = useState('admin');
  const [view, setView] = useState<SchemaView>('tree');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<SchemaSearchResult | null>(
    null,
  );
  const searchRef = useRef<SchemaSearchHandle>(null);
  const { data, error, isLoading, refetch } =
    useIntrospectGraphQLSchemaQuery(role);

  const schema = useMemo(() => (data ? buildClientSchema(data) : null), [data]);
  const sdl = useMemo(
    () => (view === 'raw' && schema ? printSchema(schema) : ''),
    [view, schema],
  );

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    setSearchResult(null);
  };

  const handleViewChange = (nextView: SchemaView) => {
    setView(nextView);
    setSearchResult(null);
  };

  const handleFind = () => {
    if (!searchTerm.trim() || !searchRef.current) {
      return;
    }

    setSearchResult(searchRef.current.find(searchTerm));
  };

  const handleStep = (direction: 'next' | 'previous') => {
    const result = searchRef.current?.[direction]();

    if (result) {
      setSearchResult(result);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="h-96 w-full animate-pulse bg-muted" />;
    }

    if (error) {
      return (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTitle>Could not load the schema</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {error.message}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!schema) {
      return null;
    }

    if (view === 'raw') {
      return <SchemaSdlView ref={searchRef} sdl={sdl} />;
    }

    return (
      <GraphQLSchemaBrowser
        ref={searchRef}
        schema={schema}
        className="min-h-96"
      />
    );
  };

  return (
    <StickyHeaderCard>
      <StickyHeaderCardHeader>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <SchemaRoleSelect value={role} onChange={handleRoleChange} />
          {schema && !error && (
            <SchemaSearchBar
              className="min-w-0 flex-1"
              term={searchTerm}
              result={searchResult}
              onTermChange={(term) => {
                setSearchTerm(term);
                setSearchResult(null);
              }}
              onFind={handleFind}
              onNext={() => handleStep('next')}
              onPrevious={() => handleStep('previous')}
            />
          )}
        </div>
        <SchemaViewToggle value={view} onChange={handleViewChange} />
      </StickyHeaderCardHeader>

      <StickyHeaderCardContent>{renderContent()}</StickyHeaderCardContent>
    </StickyHeaderCard>
  );
}
