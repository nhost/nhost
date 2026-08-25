import { format } from 'node-pg-format';
import {
  getPreparedHasuraQuery,
  type HasuraOperation,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  MutationOrQueryBaseOptions,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const TEMPORARY_NAME_PREFIX = '__nhost_tmp_';

interface UniqueConstraintQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  uniqueConstraint: UniqueConstraint;
}

interface RenameUniqueConstraintQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  originalName: string;
  name: string;
}

export interface PrepareUniqueConstraintRenameQueriesVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  uniqueConstraints?: UniqueConstraint[];
  originalUniqueConstraints?: UniqueConstraint[];
}

interface ConstraintRename {
  originalName: string;
  name: string;
}

function createTemporaryConstraintName(reservedNames: Set<string>): string {
  let sequence = 1;

  while (reservedNames.has(`${TEMPORARY_NAME_PREFIX}${sequence}`)) {
    sequence += 1;
  }

  const candidate = `${TEMPORARY_NAME_PREFIX}${sequence}`;
  reservedNames.add(candidate);
  return candidate;
}

function validateLoadedConstraintName(constraint: UniqueConstraint): void {
  if (!constraint.originalName || !constraint.name) {
    throw new Error('Loaded UNIQUE constraints must have a name.');
  }
}

function prepareConstraintRenames(
  variables: Omit<
    RenameUniqueConstraintQueryVariables,
    'originalName' | 'name'
  >,
  renames: ConstraintRename[],
  reservedNames: Set<string>,
) {
  const queries: HasuraOperation[] = [];
  const pendingRenames = new Map(
    renames.map(({ originalName, name }) => [originalName, name]),
  );

  while (pendingRenames.size > 0) {
    let directlyRunnableRename: ConstraintRename | undefined;
    for (const [originalName, targetName] of pendingRenames) {
      if (!pendingRenames.has(targetName)) {
        directlyRunnableRename = { originalName, name: targetName };
        break;
      }
    }

    if (directlyRunnableRename) {
      const { originalName, name } = directlyRunnableRename;
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
    const temporaryName = createTemporaryConstraintName(reservedNames);

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
  nullsNotDistinct,
}: Pick<UniqueConstraint, 'name' | 'columns' | 'nullsNotDistinct'>): string {
  const uniqueClause = nullsNotDistinct
    ? 'UNIQUE NULLS NOT DISTINCT'
    : 'UNIQUE';

  if (name) {
    return format('CONSTRAINT %I %s (%I)', name, uniqueClause, columns);
  }

  return format('%s (%I)', uniqueClause, columns);
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

/**
 * Prepares cycle-safe RENAME CONSTRAINT queries for constraints whose columns
 * are unchanged. Callers must pre-filter out added, dropped, and
 * column-modified constraints.
 */
export function prepareUniqueConstraintRenameQueries({
  dataSource,
  schema,
  table,
  uniqueConstraints = [],
  originalUniqueConstraints = [],
}: PrepareUniqueConstraintRenameQueriesVariables) {
  originalUniqueConstraints.forEach(validateLoadedConstraintName);

  const originalConstraintsById = new Map(
    originalUniqueConstraints.map((constraint) => [constraint.id, constraint]),
  );
  const renames = uniqueConstraints.flatMap<ConstraintRename>((constraint) => {
    const originalConstraint = originalConstraintsById.get(constraint.id);
    if (!originalConstraint) {
      return [];
    }

    validateLoadedConstraintName(constraint);
    if (originalConstraint.originalName === constraint.name) {
      return [];
    }

    return [
      {
        originalName: originalConstraint.originalName,
        name: constraint.name,
      },
    ];
  });
  const reservedNames = new Set([
    ...originalUniqueConstraints.flatMap(({ originalName, name }) => [
      originalName,
      name,
    ]),
    ...uniqueConstraints.map(({ name }) => name),
  ]);

  return prepareConstraintRenames(
    { dataSource, schema, table },
    renames,
    reservedNames,
  );
}
