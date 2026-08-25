import * as Yup from 'yup';
import type { FormUniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_MAX_IDENTIFIER_LENGTH } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

const IDENTIFIER_START_PATTERN = /^([A-Za-z]|_)+/i;
const IDENTIFIER_PATTERN = /^\w+$/i;

const NAME_RULES: { message: string; isValid: (name: string) => boolean }[] = [
  {
    message: 'Constraint name must start with a letter or underscore.',
    isValid: (name) => IDENTIFIER_START_PATTERN.test(name),
  },
  {
    message:
      'Constraint name must contain only letters, numbers, or underscores.',
    isValid: (name) => IDENTIFIER_PATTERN.test(name),
  },
  {
    message: `Constraint name must be at most ${POSTGRESQL_MAX_IDENTIFIER_LENGTH} characters.`,
    isValid: (name) => name.length <= POSTGRESQL_MAX_IDENTIFIER_LENGTH,
  },
];

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

function areReferencesDistinct(references: readonly string[]) {
  return new Set(references).size === references.length;
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
    nullsNotDistinct: Yup.boolean().required(),
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
        'unique-constraint-name',
        'Invalid constraint name.',
        function validateNameRules(value) {
          if (
            bypassNameRule(value, this.parent.originalName) ||
            !value?.trim()
          ) {
            return true;
          }

          const name = value.trim();
          const failedRule = NAME_RULES.find((rule) => !rule.isValid(name));
          if (!failedRule) {
            return true;
          }

          return this.createError({ message: failedRule.message });
        },
      ),
    columnReferences: Yup.array()
      .of(Yup.string().required())
      .required()
      .min(1, 'Select at least one column.')
      .test(
        'distinct-unique-constraint-columns',
        'Each column may only be selected once.',
        (references) => !references || areReferencesDistinct(references),
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
  const schema = createUniqueConstraintValidationSchema(
    currentColumnReferences,
  );

  return (
    constraints.every((constraint) => schema.isValidSync(constraint)) &&
    haveUniqueSuppliedConstraintNames(constraints)
  );
}
