import { useExplorerContext, useSchemaContext } from '@graphiql/react';
import type { GraphQLNamedType, GraphQLSchema } from 'graphql';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PLAYGROUND_SECTION_TITLE_CLASSES } from '@/features/orgs/projects/graphql/common/constants/playground';
import { cn } from '@/lib/utils';

/**
 * Splits a schema's types into tables and everything else, sorted by name.
 * Built in types (`__Type`…) and the root types are left out.
 */
export function groupSchemaTypes(schema: GraphQLSchema | null | undefined) {
  if (!schema) {
    return { tables: [], otherTypes: [] };
  }

  const typeMap = schema.getTypeMap();
  const rootTypeNames = new Set(
    [
      schema.getQueryType(),
      schema.getMutationType(),
      schema.getSubscriptionType(),
    ].map((type) => type?.name),
  );
  const types = Object.values(typeMap)
    .filter(
      (type) => !type.name.startsWith('__') && !rootTypeNames.has(type.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // Every table gets a matching "<table>_aggregate" type.
  const isTable = (type: GraphQLNamedType) =>
    `${type.name}_aggregate` in typeMap;

  return {
    tables: types.filter(isTable),
    otherTypes: types.filter((type) => !isTable(type)),
  };
}

function TypeLinks({ types }: { types: GraphQLNamedType[] }) {
  const explorer = useExplorerContext({ nonNull: true });

  return (
    <ul className="flex flex-col gap-2 pl-2">
      {types.map((type) => (
        <li key={type.name}>
          {/* Opens the type the same way GraphiQL's own type links do, so
              back navigation keeps working. Same color too. */}
          <button
            type="button"
            className="graphiql-doc-explorer-type-name text-left hover:underline"
            onClick={() => explorer.push({ name: type.name, def: type })}
          >
            {type.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The schema's types on the Docs start page, in place of GraphiQL's single
 * list of every type. Tables come first. The helper types Hasura generates
 * for each table (filters, inputs, aggregates…) are folded away.
 */
export default function SchemaTypeGroups() {
  const { schema } = useSchemaContext({ nonNull: true });
  const [showOtherTypes, setShowOtherTypes] = useState(false);

  const { tables, otherTypes } = useMemo(
    () => groupSchemaTypes(schema),
    [schema],
  );

  if (!schema) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {tables.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={PLAYGROUND_SECTION_TITLE_CLASSES}>
            Tables ({tables.length})
          </h2>
          <TypeLinks types={tables} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={showOtherTypes}
          onClick={() => setShowOtherTypes((value) => !value)}
          className="flex items-center gap-1 text-left"
        >
          <h2 className={PLAYGROUND_SECTION_TITLE_CLASSES}>
            Other types ({otherTypes.length})
          </h2>
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              showOtherTypes && 'rotate-90',
            )}
          />
        </button>
        {showOtherTypes && <TypeLinks types={otherTypes} />}
      </section>
    </div>
  );
}
