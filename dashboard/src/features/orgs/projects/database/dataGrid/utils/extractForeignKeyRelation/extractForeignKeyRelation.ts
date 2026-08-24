import type {
  ForeignKeyRelation,
  PostgresReferentialAction,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const UPDATE_ACTION_PATTERN =
  /\bON\s+UPDATE\s+(CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION)\b/i;
const DELETE_ACTION_PATTERN =
  /\bON\s+DELETE\s+(CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION)\b/i;
const UPDATE_MARKER_PATTERN = /\bON\s+UPDATE\b/i;
const DELETE_MARKER_PATTERN = /\bON\s+DELETE\b/i;

interface ParenthesizedGroup {
  value: string;
  endIndex: number;
}

function readParenthesizedGroup(
  value: string,
  startIndex: number,
): ParenthesizedGroup | null {
  if (value[startIndex] !== '(') {
    return null;
  }

  let quoted = false;

  for (let index = startIndex + 1; index < value.length; index += 1) {
    const character = value[index];

    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ')' && !quoted) {
      return {
        value: value.slice(startIndex + 1, index),
        endIndex: index + 1,
      };
    }
  }

  return null;
}

function splitOutsideQuotes(value: string, delimiter: string): string[] | null {
  const parts: string[] = [];
  let quoted = false;
  let partStart = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === delimiter && !quoted) {
      parts.push(value.slice(partStart, index));
      partStart = index + 1;
    }
  }

  if (quoted) {
    return null;
  }

  parts.push(value.slice(partStart));
  return parts;
}

function parsePostgresIdentifier(value: string): string | null {
  const identifier = value.trim();

  if (!identifier) {
    return null;
  }

  if (!identifier.startsWith('"')) {
    return /[\s"]/.test(identifier) ? null : identifier;
  }

  let parsed = '';

  for (let index = 1; index < identifier.length; index += 1) {
    const character = identifier[index];

    if (character !== '"') {
      parsed += character;
      continue;
    }

    if (identifier[index + 1] === '"') {
      parsed += '"';
      index += 1;
      continue;
    }

    if (identifier.slice(index + 1).trim().length > 0) {
      return null;
    }

    return parsed.length > 0 ? parsed : null;
  }

  return null;
}

/** Parse a PostgreSQL identifier list without splitting quoted commas. */
function parsePostgresIdentifierList(value: string): string[] | null {
  const rawIdentifiers = splitOutsideQuotes(value, ',');

  if (!rawIdentifiers) {
    return null;
  }

  const identifiers = rawIdentifiers.map(parsePostgresIdentifier);

  if (
    identifiers.length === 0 ||
    identifiers.some((identifier) => identifier === null)
  ) {
    return null;
  }

  return identifiers as string[];
}

function parseQualifiedTable(value: string): {
  referencedSchema: string | null;
  referencedTable: string;
} | null {
  const rawParts = splitOutsideQuotes(value, '.');

  if (!rawParts || rawParts.length < 1 || rawParts.length > 2) {
    return null;
  }

  const parts = rawParts.map(parsePostgresIdentifier);

  if (parts.some((part) => part === null)) {
    return null;
  }

  if (parts.length === 1) {
    return { referencedSchema: null, referencedTable: parts[0] as string };
  }

  return {
    referencedSchema: parts[0] as string,
    referencedTable: parts[1] as string,
  };
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function readAction(
  value: string,
  action: 'UPDATE' | 'DELETE',
): PostgresReferentialAction | null {
  const actionPattern =
    action === 'UPDATE' ? UPDATE_ACTION_PATTERN : DELETE_ACTION_PATTERN;
  const markerPattern =
    action === 'UPDATE' ? UPDATE_MARKER_PATTERN : DELETE_MARKER_PATTERN;
  const match = actionPattern.exec(value);

  if (!match && markerPattern.test(value)) {
    return null;
  }

  return (
    (match?.[1]?.toUpperCase() as PostgresReferentialAction | undefined) ??
    'NO ACTION'
  );
}

function findReferencedColumnsStart(value: string, startIndex: number): number {
  let quoted = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index];

    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === '(' && !quoted) {
      return index;
    }
  }

  return -1;
}

/**
 * Extract a complete ordered foreign-key relation from PostgreSQL's
 * `pg_get_constraintdef` output. Malformed or ambiguous mappings fail closed.
 */
export default function extractForeignKeyRelation(
  name: string,
  rawConstraintDefinition: string,
): ForeignKeyRelation | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }

  const prefix = /^\s*FOREIGN\s+KEY\s*/i.exec(rawConstraintDefinition);

  if (!prefix) {
    return null;
  }

  const localGroup = readParenthesizedGroup(
    rawConstraintDefinition,
    prefix[0].length,
  );

  if (!localGroup) {
    return null;
  }

  const afterLocalColumns = rawConstraintDefinition.slice(localGroup.endIndex);
  const referencesPrefix = /^\s*REFERENCES\s+/i.exec(afterLocalColumns);

  if (!referencesPrefix) {
    return null;
  }

  const referenceStart = localGroup.endIndex + referencesPrefix[0].length;
  const referencedColumnsStart = findReferencedColumnsStart(
    rawConstraintDefinition,
    referenceStart,
  );

  if (referencedColumnsStart < 0) {
    return null;
  }

  const referencedTable = parseQualifiedTable(
    rawConstraintDefinition.slice(referenceStart, referencedColumnsStart),
  );
  const referencedGroup = readParenthesizedGroup(
    rawConstraintDefinition,
    referencedColumnsStart,
  );

  if (!referencedTable || !referencedGroup) {
    return null;
  }

  const columns = parsePostgresIdentifierList(localGroup.value);
  const referencedColumns = parsePostgresIdentifierList(referencedGroup.value);

  if (
    !columns ||
    !referencedColumns ||
    columns.length !== referencedColumns.length ||
    hasDuplicates(columns) ||
    hasDuplicates(referencedColumns)
  ) {
    return null;
  }

  const actionClause = rawConstraintDefinition.slice(referencedGroup.endIndex);
  const updateAction = readAction(actionClause, 'UPDATE');
  const deleteAction = readAction(actionClause, 'DELETE');

  if (!updateAction || !deleteAction) {
    return null;
  }

  const relation: ForeignKeyRelation = {
    name: name.trim(),
    columns,
    ...referencedTable,
    referencedColumns,
    updateAction,
    deleteAction,
  };

  return relation;
}
