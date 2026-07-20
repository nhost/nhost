import { format } from 'node-pg-format';
import {
  getPreparedHasuraQuery,
  type HasuraOperation,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  MutationOrQueryBaseOptions,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const POSTGRES_IDENTIFIER_MAX_BYTES = 63;
const TEMPORARY_NAME_SUFFIX = '__nhost_tmp_';

interface UniqueConstraintQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  uniqueConstraint: UniqueConstraint;
}

interface RenameUniqueConstraintQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  originalName: string;
  name: string;
}

export interface PrepareUniqueConstraintDiffQueriesVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  uniqueConstraints?: UniqueConstraint[];
  originalUniqueConstraints?: UniqueConstraint[];
}

interface ConstraintRename {
  originalName: string;
  name: string;
}

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function truncateToUtf8ByteLength(value: string, maximumBytes: number): string {
  let result = '';
  let byteLength = 0;

  for (const character of value) {
    const characterByteLength = getUtf8ByteLength(character);
    if (byteLength + characterByteLength > maximumBytes) {
      break;
    }

    result += character;
    byteLength += characterByteLength;
  }

  return result;
}

function createTemporaryConstraintName(
  originalName: string,
  reservedNames: Set<string>,
): string {
  let sequence = 1;

  while (true) {
    const suffix = `${TEMPORARY_NAME_SUFFIX}${sequence}`;
    const prefix = truncateToUtf8ByteLength(
      originalName,
      POSTGRES_IDENTIFIER_MAX_BYTES - getUtf8ByteLength(suffix),
    );
    const candidate = `${prefix}${suffix}`;

    if (!reservedNames.has(candidate)) {
      reservedNames.add(candidate);
      return candidate;
    }

    sequence += 1;
  }
}

function validateLoadedConstraintName(constraint: UniqueConstraint): void {
  if (!constraint.originalName || !constraint.name) {
    throw new Error('Loaded UNIQUE constraints must have a name.');
  }
}

function hasSameOrderedColumns(
  first: UniqueConstraint,
  second: UniqueConstraint,
): boolean {
  return (
    first.columns.length === second.columns.length &&
    first.columns.every((column, index) => column === second.columns[index])
  );
}

function prepareConstraintRenames(
  variables: Omit<RenameUniqueConstraintQueryVariables, 'originalName' | 'name'>,
  renames: ConstraintRename[],
  reservedNames: Set<string>,
) {
  const queries: HasuraOperation[] = [];
  const pendingRenames = new Map(
    renames.map(({ originalName, name }) => [originalName, name]),
  );

  while (pendingRenames.size > 0) {
    const directlyRunnableRename = [...pendingRenames].find(
      ([, name]) => !pendingRenames.has(name),
    );

    if (directlyRunnableRename) {
      const [originalName, name] = directlyRunnableRename;
      queries.push(
        prepareRenameUniqueConstraintQuery({
          ...variables,
          originalName,
          name,
        }),
      );
      pendingRenames.delete(originalName);
      continue;
    }

    const [originalName, name] = pendingRenames.entries().next().value as [
      string,
      string,
    ];
    const temporaryName = createTemporaryConstraintName(
      originalName,
      reservedNames,
    );

    queries.push(
      prepareRenameUniqueConstraintQuery({
        ...variables,
        originalName,
        name: temporaryName,
      }),
    );
    pendingRenames.delete(originalName);
    pendingRenames.set(temporaryName, name);
  }

  return queries;
}

export function formatUniqueConstraintDefinition({
  name,
  columns,
}: Pick<UniqueConstraint, 'name' | 'columns'>): string {
  if (name) {
    return format('CONSTRAINT %I UNIQUE (%I)', name, columns);
  }

  return format('UNIQUE (%I)', columns);
}

export function prepareCreateUniqueConstraintQuery({
  dataSource,
  schema,
  table,
  uniqueConstraint,
}: UniqueConstraintQueryVariables) {
  return getPreparedHasuraQuery(
    dataSource,
    'ALTER TABLE %I.%I ADD %s',
    schema,
    table,
    formatUniqueConstraintDefinition(uniqueConstraint),
  );
}

export function prepareDropUniqueConstraintQuery({
  dataSource,
  schema,
  table,
  uniqueConstraint,
}: UniqueConstraintQueryVariables) {
  validateLoadedConstraintName(uniqueConstraint);

  return getPreparedHasuraQuery(
    dataSource,
    'ALTER TABLE %I.%I DROP CONSTRAINT %I',
    schema,
    table,
    uniqueConstraint.originalName,
  );
}

export function prepareRenameUniqueConstraintQuery({
  dataSource,
  schema,
  table,
  originalName,
  name,
}: RenameUniqueConstraintQueryVariables) {
  if (!originalName || !name) {
    throw new Error('Constraint renames require both names.');
  }

  return getPreparedHasuraQuery(
    dataSource,
    'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
    schema,
    table,
    originalName,
    name,
  );
}

export function prepareUniqueConstraintDiffQueries({
  dataSource,
  schema,
  table,
  uniqueConstraints = [],
  originalUniqueConstraints = [],
}: PrepareUniqueConstraintDiffQueriesVariables) {
  originalUniqueConstraints.forEach(validateLoadedConstraintName);

  const originalConstraintsById = new Map(
    originalUniqueConstraints.map((constraint) => [constraint.id, constraint]),
  );
  const currentConstraintsById = new Map(
    uniqueConstraints.map((constraint) => [constraint.id, constraint]),
  );
  uniqueConstraints.forEach((constraint) => {
    if (originalConstraintsById.has(constraint.id)) {
      validateLoadedConstraintName(constraint);
    }
  });

  const droppedConstraints = originalUniqueConstraints.filter((constraint) => {
    const currentConstraint = currentConstraintsById.get(constraint.id);
    return (
      !currentConstraint ||
      !hasSameOrderedColumns(constraint, currentConstraint)
    );
  });
  const addedConstraints = uniqueConstraints.filter((constraint) => {
    const originalConstraint = originalConstraintsById.get(constraint.id);
    return (
      !originalConstraint ||
      !hasSameOrderedColumns(originalConstraint, constraint)
    );
  });
  const renames = uniqueConstraints.flatMap<ConstraintRename>((constraint) => {
    const originalConstraint = originalConstraintsById.get(constraint.id);
    if (
      !originalConstraint ||
      !hasSameOrderedColumns(originalConstraint, constraint) ||
      originalConstraint.originalName === constraint.name
    ) {
      return [];
    }

    validateLoadedConstraintName(constraint);
    return [
      {
        originalName: originalConstraint.originalName,
        name: constraint.name,
      },
    ];
  });
  const baseVariables = { dataSource, schema, table };
  const reservedNames = new Set([
    ...originalUniqueConstraints.flatMap(({ originalName, name }) => [
      originalName,
      name,
    ]),
    ...uniqueConstraints.map(({ name }) => name),
  ]);

  return [
    ...droppedConstraints.map((uniqueConstraint) =>
      prepareDropUniqueConstraintQuery({
        ...baseVariables,
        uniqueConstraint,
      }),
    ),
    ...prepareConstraintRenames(baseVariables, renames, reservedNames),
    ...addedConstraints.map((uniqueConstraint) =>
      prepareCreateUniqueConstraintQuery({
        ...baseVariables,
        uniqueConstraint,
      }),
    ),
  ];
}
