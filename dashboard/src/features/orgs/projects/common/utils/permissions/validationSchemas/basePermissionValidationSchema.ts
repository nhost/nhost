import * as Yup from 'yup';

import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';

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

export const filterValidationSchema = groupNodeSchema
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
  );

export const baseValidationSchema = Yup.object().shape({
  filter: filterValidationSchema,
  columns: Yup.array().of(Yup.string()).nullable(),
});
