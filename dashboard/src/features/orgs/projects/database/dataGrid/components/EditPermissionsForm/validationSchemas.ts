import * as Yup from 'yup';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

function findSerializationCollision(group: GroupNode): string | null {
  if (!group.children) {
    return null;
  }

  const isFlatGroup =
    group.operator === '_implicit' ||
    (group.operator === '_not' && group.children.length > 1);

  if (isFlatGroup) {
    const seenConditions = new Set<string>();
    for (const child of group.children) {
      if (child.type === 'condition') {
        const key = `${child.column}::${child.operator}`;
        if (seenConditions.has(key)) {
          return `Column "${child.column}" with operator "${child.operator}" appears more than once in the same group. Please remove the duplicate condition.`;
        }
        seenConditions.add(key);
      }
    }

    const seenLogicalOps = new Set<string>();
    for (const child of group.children) {
      if (child.type === 'group' && child.operator !== '_implicit') {
        if (seenLogicalOps.has(child.operator)) {
          return `Multiple "${child.operator}" groups at the same level cannot be saved correctly. Wrap them inside a single "${child.operator}" group instead.`;
        }
        seenLogicalOps.add(child.operator);
      }
    }

    let existsCount = 0;
    for (const child of group.children) {
      if (child.type === 'exists') {
        existsCount++;
        if (existsCount > 1) {
          return 'Multiple "_exists" conditions at the same level cannot be saved correctly. Wrap them in an "_and" or "_or" group instead.';
        }
      }
    }

    const seenRelationships = new Set<string>();
    for (const child of group.children) {
      if (child.type === 'relationship') {
        const root = child.relationship.split('.')[0];
        if (seenRelationships.has(root)) {
          return `Multiple conditions on relationship "${root}" at the same level cannot be saved correctly. Wrap them in an "_and" or "_or" group instead.`;
        }
        seenRelationships.add(root);
      }
    }
  }

  for (const child of group.children) {
    if (child.type === 'group') {
      const collision = findSerializationCollision(child);
      if (collision) {
        return collision;
      }
    }
    if (child.type === 'exists') {
      const collision = findSerializationCollision(child.where);
      if (collision) {
        return collision;
      }
    }
    if (child.type === 'relationship') {
      const collision = findSerializationCollision(child.child);
      if (collision) {
        return collision;
      }
    }
  }

  return null;
}

const conditionNodeSchema = Yup.object().shape({
  type: Yup.string(),
  id: Yup.string(),
  column: Yup.string().nullable().required('Please select a column.'),
  operator: Yup.string().nullable().required('Please select an operator.'),
  value: Yup.mixed()
    .test(
      'isArray',
      'Please enter a valid value.',
      (value) =>
        typeof value === 'string' ||
        (Array.isArray(value) &&
          value.every((item) => typeof item === 'string')),
    )
    .nullable()
    .required('Please enter a value.'),
});

// biome-ignore lint/suspicious/noExplicitAny: recursive schema requires any
const groupNodeSchema: Yup.ObjectSchema<any> = Yup.object().shape({
  type: Yup.string(),
  id: Yup.string(),
  operator: Yup.string(),
  children: Yup.array().of(
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union requires any
    Yup.lazy((value: any) => {
      if (value?.type === 'condition') {
        return conditionNodeSchema;
      }
      if (value?.type === 'exists') {
        return existsNodeSchema;
      }
      if (value?.type === 'relationship') {
        return relationshipNodeSchema;
      }
      return groupNodeSchema;
      // biome-ignore lint/suspicious/noExplicitAny: discriminated union requires any
    }) as any,
  ),
});

// biome-ignore lint/suspicious/noExplicitAny: recursive schema requires any
const existsNodeSchema: Yup.ObjectSchema<any> = Yup.object().shape({
  type: Yup.string(),
  id: Yup.string(),
  schema: Yup.string().required('Please select a schema.'),
  table: Yup.string().required('Please select a table.'),
  where: groupNodeSchema,
});

// biome-ignore lint/suspicious/noExplicitAny: recursive schema requires any
const relationshipNodeSchema: Yup.ObjectSchema<any> = Yup.object().shape({
  type: Yup.string(),
  id: Yup.string(),
  relationship: Yup.string()
    .nullable()
    .required('Please select a relationship.'),
  child: groupNodeSchema,
});

const baseValidationSchema = Yup.object().shape({
  filter: groupNodeSchema
    .nullable()
    .test(
      'no-serialization-collisions',
      '',
      function validateNoSerializationCollisions(value) {
        if (!value) {
          return true;
        }
        const collision = findSerializationCollision(value as GroupNode);
        if (!collision) {
          return true;
        }
        return this.createError({
          message: collision,
        });
      },
    ),
  columns: Yup.array().of(Yup.string()).nullable(),
});

const selectValidationSchema = baseValidationSchema.shape({
  limit: Yup.number()
    .label('Limit')
    .min(0, 'Limit must not be negative.')
    .nullable(),
  allowAggregations: Yup.boolean().nullable(),
  queryRootFields: Yup.array().of(Yup.string()).nullable(),
  subscriptionRootFields: Yup.array().of(Yup.string()).nullable(),
});

const columnPresetSchema = Yup.object().shape({
  column: Yup.string()
    .nullable()
    .test('column', 'Please select a column.', (selectedColumn, ctx) => {
      // biome-ignore lint/suspicious/noExplicitAny: `from` is part of the Yup API but not typed
      const [, { value }] = (ctx as any).from;

      if (
        (value.columnPresets.length > 1 && !selectedColumn) ||
        (!!ctx.parent.value && !selectedColumn)
      ) {
        return false;
      }

      return true;
    }),
  value: Yup.string()
    .nullable()
    .test('value', 'Please enter a value.', (selectedValue, ctx) => {
      // biome-ignore lint/suspicious/noExplicitAny: `from` is part of the Yup API but not typed
      const [, { value }] = (ctx as any).from;

      if (
        (value.columnPresets.length > 1 && !selectedValue) ||
        (!!ctx.parent.column && !selectedValue)
      ) {
        return false;
      }

      return true;
    }),
});

const insertValidationSchema = baseValidationSchema.shape({
  backendOnly: Yup.boolean().nullable(),
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const updateValidationSchema = baseValidationSchema.shape({
  backendOnly: Yup.boolean().nullable(),
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const deleteValidationSchema = baseValidationSchema.shape({
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

// biome-ignore lint/suspicious/noExplicitAny: TODO
const validationSchemas: Record<DatabaseAction, Yup.ObjectSchema<any>> = {
  select: selectValidationSchema,
  insert: insertValidationSchema,
  update: updateValidationSchema,
  delete: deleteValidationSchema,
};

export default validationSchemas;
