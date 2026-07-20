import * as Yup from 'yup';
import type { FormUniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_MAX_IDENTIFIER_LENGTH } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants/postgresqlConstants';

const IDENTIFIER_START_PATTERN = /^([A-Za-z]|_)+/i;
const IDENTIFIER_PATTERN = /^\w+$/i;

function isLoadedConstraint(
  constraint: Pick<FormUniqueConstraint, 'originalName'>,
) {
  return Boolean(constraint.originalName);
}

function isUnchangedLoadedName(
  constraint: Pick<FormUniqueConstraint, 'name' | 'originalName'>,
) {
  return (
    isLoadedConstraint(constraint) &&
    (constraint.name ?? '') === constraint.originalName
  );
}

export function isUniqueConstraintNameValid(
  constraint: Pick<FormUniqueConstraint, 'name' | 'originalName'>,
) {
  const rawName = constraint.name ?? '';
  const name = rawName.trim();

  return (
    isUnchangedLoadedName(constraint) ||
    (!name && !isLoadedConstraint(constraint)) ||
    (IDENTIFIER_START_PATTERN.test(name) &&
      IDENTIFIER_PATTERN.test(name) &&
      name.length <= POSTGRESQL_MAX_IDENTIFIER_LENGTH)
  );
}

export function areUniqueConstraintReferencesValid(
  constraint: Pick<FormUniqueConstraint, 'columnReferences'>,
  currentColumnReferences: ReadonlySet<string>,
) {
  const references = constraint.columnReferences ?? [];

  return (
    references.length > 0 &&
    new Set(references).size === references.length &&
    references.every((reference) => currentColumnReferences.has(reference))
  );
}

export function haveUniqueSuppliedConstraintNames(
  constraints: readonly Pick<FormUniqueConstraint, 'name'>[],
) {
  const suppliedNames = new Set<string>();

  return constraints.every(({ name: rawName = '' }) => {
    const name = rawName.trim();
    if (!name) {
      return true;
    }
    if (suppliedNames.has(name)) {
      return false;
    }

    suppliedNames.add(name);
    return true;
  });
}

export function areUniqueConstraintsValid(
  constraints: readonly FormUniqueConstraint[],
  currentColumnReferences: ReadonlySet<string>,
) {
  return (
    constraints.every(
      (constraint) =>
        isUniqueConstraintNameValid(constraint) &&
        areUniqueConstraintReferencesValid(constraint, currentColumnReferences),
    ) && haveUniqueSuppliedConstraintNames(constraints)
  );
}

function bypassNameRule(
  value: string | undefined,
  originalName: string | undefined,
) {
  return isUnchangedLoadedName({ name: value, originalName });
}

export function createUniqueConstraintValidationSchema(
  currentColumnReferences: ReadonlySet<string>,
) {
  return Yup.object({
    id: Yup.string().required(),
    originalName: Yup.string().optional(),
    name: Yup.string()
      .optional()
      .test(
        'required-loaded-unique-constraint-name',
        'A name is required for an existing UNIQUE constraint.',
        function validateRequiredLoadedName(value) {
          if (bypassNameRule(value, this.parent.originalName)) {
            return true;
          }

          return !isLoadedConstraint(this.parent) || Boolean(value?.trim());
        },
      )
      .test(
        'unique-constraint-name-start',
        'Constraint name must start with a letter or underscore.',
        function validateNameStart(value) {
          if (
            bypassNameRule(value, this.parent.originalName) ||
            !value?.trim()
          ) {
            return true;
          }

          return IDENTIFIER_START_PATTERN.test(value.trim());
        },
      )
      .test(
        'unique-constraint-name-characters',
        'Constraint name must contain only letters, numbers, or underscores.',
        function validateNameCharacters(value) {
          if (
            bypassNameRule(value, this.parent.originalName) ||
            !value?.trim()
          ) {
            return true;
          }

          return IDENTIFIER_PATTERN.test(value.trim());
        },
      )
      .test(
        'unique-constraint-name-length',
        `Constraint name must be at most ${POSTGRESQL_MAX_IDENTIFIER_LENGTH} characters.`,
        function validateNameLength(value) {
          if (
            bypassNameRule(value, this.parent.originalName) ||
            !value?.trim()
          ) {
            return true;
          }

          return value.trim().length <= POSTGRESQL_MAX_IDENTIFIER_LENGTH;
        },
      ),
    columnReferences: Yup.array()
      .of(Yup.string().required())
      .required()
      .min(1, 'Select at least one column.')
      .test(
        'distinct-unique-constraint-columns',
        'Each column may only be selected once.',
        (references) =>
          !references || new Set(references).size === references.length,
      )
      .test(
        'current-unique-constraint-columns',
        'Select only current columns. Remove any missing columns.',
        (references) =>
          !references ||
          references.every((reference) =>
            currentColumnReferences.has(reference),
          ),
      ),
  });
}
