import { useMemo, useState } from 'react';
import {
  GraphQLSchemaBrowser,
  SchemaSearchBar,
  useSchemaSearch,
} from '@/features/orgs/projects/graphql/common/components/GraphQLSchemaBrowser';
import useIntrospectRemoteSchemaQuery from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';

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
  const search = useSchemaSearch();

  const schema = useMemo(() => {
    if (introspectionData) {
      return convertIntrospectionToSchema(introspectionData);
    }
    return null;
  }, [introspectionData]);

  // The browser drops its matches when it gets a new schema, e.g. after a
  // reload, so the search bar must forget the old result too.
  const [searchedSchema, setSearchedSchema] = useState(schema);

  if (schema !== searchedSchema) {
    setSearchedSchema(schema);
    search.resetResult();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">Loading schema...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-red-600 text-sm">
          Error introspecting:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">
          No schema data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-col gap-3 border-b p-4">
        <div>
          <h3 className="font-medium text-sm">Schema Preview</h3>
          <p className="mt-1 text-muted-foreground text-xs">
            Browse the GraphQL schema structure
          </p>
        </div>

        <SchemaSearchBar
          term={search.term}
          result={search.result}
          onTermChange={search.changeTerm}
          onFind={search.find}
          onNext={search.next}
          onPrevious={search.previous}
        />
      </div>

      <GraphQLSchemaBrowser
        ref={search.searchRef}
        schema={schema}
        className="min-h-[400px] p-4"
      />
    </div>
  );
}
