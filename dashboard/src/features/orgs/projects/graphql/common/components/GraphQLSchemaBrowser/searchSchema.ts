import type { GraphQLSchema } from 'graphql';
import {
  getArgumentNodes,
  getChildItemId,
  getNodeLabel,
  getOperationNodes,
  getTypeMemberNodes,
  ROOT_ITEM_ID,
} from './schemaTreeItems';
import type { SchemaTreeNode } from './types';

interface SearchEntry {
  id: string;
  label: string;
  parent: number;
}

interface SearchIndex {
  entries: SearchEntry[];
  /**
   * Entry indexes in tree order.
   */
  order: number[];
}

const searchIndexCache = new WeakMap<GraphQLSchema, SearchIndex>();

/**
 * Lists every schema location once, in tree order, at its shallowest tree
 * position.
 *
 * The tree is infinite when types reference each other, but its content is
 * not: a field's arguments only appear under that field, and a type's members
 * are the same under every node of that type. A breadth-first walk that lists
 * each type's members only the first time the type is reached therefore visits
 * every location exactly once, through the shortest path.
 */
function buildSearchIndex(schema: GraphQLSchema): SearchIndex {
  const entries: SearchEntry[] = [];
  const children: number[][] = [];
  const queue: { node: SchemaTreeNode; entry: number }[] = [];
  const expandedTypes = new Set<string>();

  const addEntry = (node: SchemaTreeNode, parent: number) => {
    const parentId = parent === -1 ? ROOT_ITEM_ID : entries[parent].id;
    const entry = entries.length;

    entries.push({
      id: getChildItemId(parentId, node),
      label: getNodeLabel(node),
      parent,
    });
    children.push([]);
    children[parent]?.push(entry);
    queue.push({ node, entry });
  };

  for (const operation of getOperationNodes(schema)) {
    addEntry(operation, -1);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const { node, entry } = queue[head];

    for (const argument of getArgumentNodes(schema, node)) {
      addEntry(argument, entry);
    }

    if (node.typeName && !expandedTypes.has(node.typeName)) {
      expandedTypes.add(node.typeName);

      for (const member of getTypeMemberNodes(schema, node.typeName)) {
        addEntry(member, entry);
      }
    }
  }

  const order: number[] = [];
  const stack = entries
    .map((_, index) => index)
    .filter((index) => entries[index].parent === -1)
    .reverse();

  while (stack.length > 0) {
    const index = stack.pop()!;

    order.push(index);

    for (let child = children[index].length - 1; child >= 0; child -= 1) {
      stack.push(children[index][child]);
    }
  }

  return { entries, order };
}

function getSearchIndex(schema: GraphQLSchema): SearchIndex {
  let index = searchIndexCache.get(schema);

  if (!index) {
    index = buildSearchIndex(schema);
    searchIndexCache.set(schema, index);
  }

  return index;
}

/**
 * Finds the schema locations whose label (`name: Type`) contains the term,
 * case-insensitively. Each match is the list of item ids from its operation
 * down to the matching item, in tree order.
 */
export default function searchSchema(
  schema: GraphQLSchema,
  term: string,
): string[][] {
  const search = term.trim().toLowerCase();

  if (!search) {
    return [];
  }

  const { entries, order } = getSearchIndex(schema);

  return order.flatMap((index) => {
    if (!entries[index].label.toLowerCase().includes(search)) {
      return [];
    }

    const path: string[] = [];

    for (
      let current = index;
      current !== -1;
      current = entries[current].parent
    ) {
      path.unshift(entries[current].id);
    }

    return [path];
  });
}
