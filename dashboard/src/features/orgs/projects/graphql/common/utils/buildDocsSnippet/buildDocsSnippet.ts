import {
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  getNamedType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from 'graphql';

// Deep enough for an aggregate (`aggregate { count }`), shallow enough that a
// snippet never walks into relationships.
const MAX_DEPTH = 3;
const DEFAULT_LIMIT = 10;

type AnyField = GraphQLField<unknown, unknown>;

const isRequired = (arg: GraphQLArgument) =>
  isNonNullType(arg.type) && arg.defaultValue === undefined;

// Lists get a limit, so a first run doesn't fetch a whole table. Required
// arguments become variables, declared by the query (see buildTableQuery).
function printArgs(field: AnyField) {
  const unwrapped = isNonNullType(field.type) ? field.type.ofType : field.type;
  const args = field.args
    .filter(
      (arg) =>
        isRequired(arg) || (arg.name === 'limit' && isListType(unwrapped)),
    )
    .map((arg) =>
      isRequired(arg)
        ? `${arg.name}: $${arg.name}`
        : `${arg.name}: ${DEFAULT_LIMIT}`,
    );

  return args.length > 0 ? `(${args.join(', ')})` : '';
}

// Fields that can be selected without arguments of their own.
const selectableFields = (type: GraphQLNamedType) =>
  isObjectType(type)
    ? Object.values(type.getFields()).filter(
        (field) => !field.deprecationReason && !field.args.some(isRequired),
      )
    : [];

function printSelection(type: GraphQLNamedType, depth: number): string[] {
  const fields = selectableFields(type);
  const leaves = fields.filter((field) => isLeafType(getNamedType(field.type)));

  if (leaves.length > 0) {
    return leaves.map((field) => field.name);
  }

  // No plain columns (an aggregate): go one level into the first object.
  if (depth >= MAX_DEPTH) {
    return [];
  }

  for (const field of fields) {
    const inner = printSelection(getNamedType(field.type), depth + 1);

    if (inner.length > 0) {
      return [
        `${field.name}${printArgs(field)} {`,
        ...inner.map((line) => `  ${line}`),
        '}',
      ];
    }
  }

  return [];
}

/**
 * A field as it can be pasted into a query: its name for a column, or the
 * field with its columns selected for a table or relationship.
 */
export function buildFieldSnippet(field: AnyField): string {
  const type = getNamedType(field.type);

  if (isLeafType(type)) {
    return field.name;
  }

  const selection = printSelection(type, 1);

  return [
    `${field.name}${printArgs(field)} {`,
    ...selection.map((line) => `  ${line}`),
    '}',
  ].join('\n');
}

/**
 * A ready to run query for a table: the root query field that lists its rows,
 * with the table's columns selected. Null when the schema has no such field.
 */
export function buildTableQuery(
  schema: GraphQLSchema,
  type: GraphQLNamedType,
): string | null {
  const rootFields = Object.values(schema.getQueryType()?.getFields() ?? {});
  const field = rootFields.find((candidate) => {
    const unwrapped = isNonNullType(candidate.type)
      ? candidate.type.ofType
      : candidate.type;

    return isListType(unwrapped) && getNamedType(candidate.type) === type;
  });

  if (!field) {
    return null;
  }

  const variables = field.args
    .filter(isRequired)
    .map((arg) => `$${arg.name}: ${String(arg.type)}`);
  const name = `Get${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`;
  const header =
    variables.length > 0 ? `${name}(${variables.join(', ')})` : name;

  return [
    `query ${header} {`,
    ...buildFieldSnippet(field)
      .split('\n')
      .map((line) => `  ${line}`),
    '}',
  ].join('\n');
}
