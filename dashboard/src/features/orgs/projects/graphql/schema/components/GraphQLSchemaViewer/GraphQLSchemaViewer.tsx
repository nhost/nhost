import { buildClientSchema, type GraphQLSchema, printSchema } from 'graphql';
import { useMemo, useState } from 'react';
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
  useSchemaSearch,
} from '@/features/orgs/projects/graphql/common/components/GraphQLSchemaBrowser';
import { SchemaRoleSelect } from '@/features/orgs/projects/graphql/schema/components/SchemaRoleSelect';
import { SchemaSdlView } from '@/features/orgs/projects/graphql/schema/components/SchemaSdlView';
import {
  type SchemaView,
  SchemaViewToggle,
} from '@/features/orgs/projects/graphql/schema/components/SchemaViewToggle';
import { useIntrospectGraphQLSchemaQuery } from '@/features/orgs/projects/graphql/schema/hooks/useIntrospectGraphQLSchemaQuery';

function printSdl(schema: GraphQLSchema) {
  try {
    return { sdl: printSchema(schema), error: null };
  } catch (printError) {
    // printSchema throws on custom scalar object or list defaults.
    return {
      sdl: '',
      error:
        printError instanceof Error ? printError.message : String(printError),
    };
  }
}

export default function GraphQLSchemaViewer() {
  const [role, setRole] = useState('admin');
  const [view, setView] = useState<SchemaView>('tree');
  const search = useSchemaSearch();
  const { data, error, isLoading, refetch } =
    useIntrospectGraphQLSchemaQuery(role);

  const schema = useMemo(() => (data ? buildClientSchema(data) : null), [data]);
  const printed = useMemo(
    () => (view === 'raw' && schema ? printSdl(schema) : null),
    [view, schema],
  );

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    search.resetResult();
  };

  const handleViewChange = (nextView: SchemaView) => {
    setView(nextView);
    search.resetResult();
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

    if (printed?.error) {
      return (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTitle>Could not show the schema as SDL</AlertTitle>
            <AlertDescription>
              {printed.error} The Tree view still shows the schema.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (printed) {
      return <SchemaSdlView ref={search.searchRef} sdl={printed.sdl} />;
    }

    return (
      <GraphQLSchemaBrowser
        ref={search.searchRef}
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
          {schema && !error && !printed?.error && (
            <SchemaSearchBar
              className="min-w-0 flex-1"
              term={search.term}
              result={search.result}
              onTermChange={search.changeTerm}
              onFind={search.find}
              onNext={search.next}
              onPrevious={search.previous}
            />
          )}
        </div>
        <SchemaViewToggle value={view} onChange={handleViewChange} />
      </StickyHeaderCardHeader>

      <StickyHeaderCardContent>{renderContent()}</StickyHeaderCardContent>
    </StickyHeaderCard>
  );
}
