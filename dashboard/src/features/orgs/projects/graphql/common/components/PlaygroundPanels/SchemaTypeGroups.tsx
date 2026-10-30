import { useExplorerContext, useSchemaContext } from '@graphiql/react';
import type {
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { PLAYGROUND_SECTION_TITLE_CLASSES } from '@/features/orgs/projects/graphql/common/constants/playground';
import { getMemberCount } from '@/features/orgs/projects/graphql/common/utils/describeSchemaType';
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

// A section title with its count after it, like GraphiQL's sections here.
export function SectionTitle({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <h2 className={PLAYGROUND_SECTION_TITLE_CLASSES}>
      {title}
      {count !== undefined && (
        <span className="ml-1.5 font-normal tracking-normal">{count}</span>
      )}
    </h2>
  );
}

// One type per row: the whole row is the link, with its field count on the
// right and an arrow on hover. Opens the type the same way GraphiQL's own
// type links do, so the breadcrumb keeps working.
function TypeRow({
  type,
  label,
}: {
  type: GraphQLNamedType;
  label?: ReactNode;
}) {
  const explorer = useExplorerContext({ nonNull: true });
  const count = getMemberCount(type);

  return (
    <li>
      <button
        type="button"
        onClick={() => explorer.push({ name: type.name, def: type })}
        className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
      >
        <span className="min-w-0 flex-1 truncate">
          {label ?? (
            <span className="graphiql-doc-explorer-type-name">{type.name}</span>
          )}
        </span>
        {count && (
          <span className="shrink-0 text-muted-foreground text-xs">
            {count}
          </span>
        )}
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    </li>
  );
}

function TypeRows({ types }: { types: GraphQLNamedType[] }) {
  return (
    <ul className="flex flex-col">
      {types.map((type) => (
        <TypeRow key={type.name} type={type} />
      ))}
    </ul>
  );
}

/**
 * The Docs start page, in place of GraphiQL's root types and single list of
 * every type: root types, then tables, then the helper types Hasura
 * generates for each table (filters, inputs, aggregates…), folded away.
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

  const rootTypes: { operation: string; type: GraphQLObjectType }[] = [];

  for (const [operation, type] of [
    ['query', schema.getQueryType()],
    ['mutation', schema.getMutationType()],
    ['subscription', schema.getSubscriptionType()],
  ] as const) {
    if (type) {
      rootTypes.push({ operation, type });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionTitle title="Root types" />
        <ul className="flex flex-col">
          {rootTypes.map(({ operation, type }) => (
            <TypeRow
              key={operation}
              type={type}
              label={
                <>
                  {/* GraphiQL only colors field names on links: same blue. */}
                  <span className="text-[hsl(var(--color-info))]">
                    {operation}
                  </span>
                  :{' '}
                  <span className="graphiql-doc-explorer-type-name">
                    {type.name}
                  </span>
                </>
              }
            />
          ))}
        </ul>
      </section>

      {tables.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle title="Tables" count={tables.length} />
          <TypeRows types={tables} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={showOtherTypes}
          onClick={() => setShowOtherTypes((value) => !value)}
          className="flex items-center gap-1 text-left"
        >
          <SectionTitle title="Other types" count={otherTypes.length} />
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              showOtherTypes && 'rotate-90',
            )}
          />
        </button>
        {showOtherTypes && <TypeRows types={otherTypes} />}
      </section>
    </div>
  );
}
