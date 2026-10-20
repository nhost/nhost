import type { GraphQLSchema } from 'graphql';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { cn } from '@/lib/utils';
import SchemaNodeDetails from './SchemaNodeDetails';
import SchemaTree from './SchemaTree';
import searchSchema from './searchSchema';
import type { SchemaSearchHandle } from './types';
import useSchemaTree from './useSchemaTree';
import useSearchMatches from './useSearchMatches';

export interface GraphQLSchemaBrowserProps {
  schema: GraphQLSchema;
  className?: string;
}

const schemaKeys = new WeakMap<GraphQLSchema, number>();
let nextSchemaKey = 0;

function getSchemaKey(schema: GraphQLSchema): number {
  let key = schemaKeys.get(schema);

  if (key === undefined) {
    nextSchemaKey += 1;
    key = nextSchemaKey;
    schemaKeys.set(schema, key);
  }

  return key;
}

const SchemaBrowser = forwardRef<SchemaSearchHandle, GraphQLSchemaBrowserProps>(
  ({ schema, className }, ref) => {
    const tree = useSchemaTree(schema);
    const matches = useSearchMatches<string[]>((paths, index) => {
      if (paths.length > 0) {
        tree.reveal(paths[index]);
      }
    });
    const [highlightTerm, setHighlightTerm] = useState('');

    useImperativeHandle(ref, () => ({
      find: (term) => {
        setHighlightTerm(term);

        return matches.start(searchSchema(schema, term));
      },
      next: matches.next,
      previous: matches.previous,
    }));

    return (
      <div
        className={cn(
          'grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6',
          className,
        )}
      >
        <div className="min-w-0 lg:border-r lg:pr-6">
          <SchemaTree
            items={tree.items}
            expandedItems={tree.expandedItems}
            focusedItem={tree.focusedItem}
            selectedItems={tree.selectedItems}
            highlightTerm={highlightTerm}
            onExpand={tree.expand}
            onCollapse={tree.collapse}
            onFocus={tree.focus}
            onSelect={tree.select}
          />
        </div>
        <SchemaNodeDetails
          schema={schema}
          node={
            tree.focusedItem ? tree.items[tree.focusedItem]?.data : undefined
          }
          className="border-t pt-4 lg:sticky lg:top-[calc(var(--sticky-header-height,0px)+1.5rem)] lg:self-start lg:border-t-0 lg:pt-0"
        />
      </div>
    );
  },
);
SchemaBrowser.displayName = 'SchemaBrowser';

/**
 * Browses a GraphQL schema as a tree, starting from its root operations, with
 * a details panel. Search is driven through the ref. All tree and search state
 * is reset when `schema` changes.
 */
const GraphQLSchemaBrowser = forwardRef<
  SchemaSearchHandle,
  GraphQLSchemaBrowserProps
>((props, ref) => (
  <SchemaBrowser key={getSchemaKey(props.schema)} ref={ref} {...props} />
));
GraphQLSchemaBrowser.displayName = 'GraphQLSchemaBrowser';

export default GraphQLSchemaBrowser;
