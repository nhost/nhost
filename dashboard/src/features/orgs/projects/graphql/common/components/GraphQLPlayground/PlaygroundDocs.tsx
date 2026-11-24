import {
  Breadcrumb,
  FieldDocumentation,
  SearchRow,
  TypeCard,
  TypeDocumentation,
  useDocExplorer,
  useDocExplorerActions,
} from '@graphiql/plugin-doc-explorer';
import { pick, Spinner, useGraphiQL } from '@graphiql/react';
import {
  type GraphQLNamedType,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isType,
  isUnionType,
} from 'graphql';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useOpenQueryInTab } from '@/features/orgs/projects/graphql/common/hooks/useOpenQueryInTab';
import { buildTableQuery } from '@/features/orgs/projects/graphql/common/utils/buildDocsSnippet';
import { isTableType } from '@/features/orgs/projects/graphql/common/utils/groupSchemaTypes';
import { triggerToast } from '@/utils/toast';
import DocsFieldList from './DocsFieldList';
import SchemaTypeGroups from './SchemaTypeGroups';

// A table's page opens a ready to run query for it.
function NewQueryButton({ query }: { query: string }) {
  const openQueryInTab = useOpenQueryInTab();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          className="shrink-0 gap-1.5 px-2.5"
          onClick={() => {
            if (!openQueryInTab(query)) {
              triggerToast('This query is already open');
            }
          }}
        >
          <Plus className="size-3.5" />
          New query
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        Opens a ready to run query for this table in a new tab
      </TooltipContent>
    </Tooltip>
  );
}

// A type's page: GraphiQL's card, our field list, and GraphiQL's sections for
// what a field list doesn't cover (enum values, union members…).
function TypeView({ type }: { type: GraphQLNamedType }) {
  return (
    <>
      <TypeCard type={type} />
      {(isObjectType(type) ||
        isInterfaceType(type) ||
        isInputObjectType(type)) && <DocsFieldList type={type} />}
      {(isEnumType(type) || isUnionType(type) || isInterfaceType(type)) && (
        <div className="graphiql-doc-explorer-type-extra">
          <TypeDocumentation type={type} hideHeader />
        </div>
      )}
    </>
  );
}

function getTableQuery(schema: GraphQLSchema | null | undefined, def: unknown) {
  if (!schema || !isObjectType(def) || !isTableType(schema, def)) {
    return null;
  }

  return buildTableQuery(schema, def);
}

/**
 * The Docs tab: GraphiQL's search, breadcrumb and type and field pages, with
 * our grouped start page, field list with copy buttons, and New query for a
 * table.
 */
export default function PlaygroundDocs() {
  const { fetchError, isIntrospecting, schema, validationErrors } = useGraphiQL(
    pick('fetchError', 'isIntrospecting', 'schema', 'validationErrors'),
  );
  const navStack = useDocExplorer();
  const { pop } = useDocExplorerActions();
  const navItem = navStack[navStack.length - 1];
  const tableQuery = getTableQuery(schema, navItem.def);

  function navigateTo(index: number) {
    for (let step = index; step < navStack.length - 1; step += 1) {
      pop();
    }
  }

  let content: ReactNode = null;

  if (fetchError) {
    content = (
      <div className="graphiql-doc-explorer-error">Error fetching schema</div>
    );
  } else if (validationErrors[0]) {
    content = (
      <div className="graphiql-doc-explorer-error">
        Schema is invalid: {validationErrors[0].message}
      </div>
    );
  } else if (!schema) {
    // GraphiQL clears the schema while it fetches it again for another user,
    // role or headers.
    content = isIntrospecting ? (
      <Spinner />
    ) : (
      <div className="graphiql-doc-explorer-error">
        No GraphQL schema available
      </div>
    );
  } else if (navStack.length === 1) {
    content = <SchemaTypeGroups schema={schema} />;
  } else if (isType(navItem.def)) {
    content = <TypeView type={navItem.def} />;
  } else if (navItem.def) {
    content = <FieldDocumentation field={navItem.def} />;
  }

  return (
    <section
      aria-label="Documentation Explorer"
      // The search's Ctrl+K hint: that shortcut is the command palette's.
      className="graphiql-doc-explorer [&_.graphiql-keycap-hint]:hidden"
    >
      {/* Keyed by page, like GraphiQL's: the search starts empty on each. */}
      <SearchRow key={navItem.name} />

      {navStack.length > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2 pr-4">
          <Breadcrumb navStack={navStack} onNavigateTo={navigateTo} />
          {tableQuery && <NewQueryButton query={tableQuery} />}
        </div>
      )}

      <div className="graphiql-doc-explorer-content">{content}</div>
    </section>
  );
}
