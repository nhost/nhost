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
    .test('isArray', 'Please enter a valid value.', (value) => {
      const isPrimitive = (item: unknown) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean';
      return (
        isPrimitive(value) || (Array.isArray(value) && value.every(isPrimitive))
      );
    })
    .nullable()
    .required('Please enter a value.'),
});

const invalidNodeSchema = Yup.object()
  .shape({
    type: Yup.string(),
    id: Yup.string(),
    reason: Yup.string(),
    key: Yup.string(),
  })
  .test('not-invalid', '', function validateInvalidNode(value) {
    if (!value || value.type !== 'invalid') {
      return true;
    }
    const { reason, key } = value as { reason: string; key: string };
    const message =
      reason === 'primitive'
        ? `"${key}" has a primitive value — did you mean {"_eq": ...}?`
        : `"${key}" is not a valid operator — did you mean "_and" or "_or"?`;
    return this.createError({ message });
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
      if (value?.type === 'invalid') {
        return invalidNodeSchema;
      }
      return groupNodeSchema;
      // biome-ignore lint/suspicious/noExplicitAny: discriminated union requires any
    }) as any,
  ),
});

function groupHasLeaf(value: unknown): boolean {
  if (!value) {
    return false;
  }
  const group = value as GroupNode;
  if (!Array.isArray(group.children) || group.children.length === 0) {
    return false;
  }
  return group.children.some((child) => {
    if (child.type === 'group') {
      return groupHasLeaf(child);
    }
    return true;
  });
}

// biome-ignore lint/suspicious/noExplicitAny: recursive schema requires any
const existsNodeSchema: Yup.ObjectSchema<any> = Yup.object().shape({
  type: Yup.string(),
  id: Yup.string(),
  schema: Yup.string().required('Please select a schema.'),
  table: Yup.string().required('Please select a table.'),
  where: groupNodeSchema.test(
    'exists-where-not-empty',
    'Please add at least one condition inside the exists block.',
    groupHasLeaf,
  ),
});

// biome-ignore lint/suspicious/noExplicitAny: recursive schema requires any
const relationshipNodeSchema: Yup.ObjectSchema<any> = Yup.object().shape({
  type: Yup.string(),
  id: Yup.string(),
  relationship: Yup.string()
    .nullable()
    .required('Please select a relationship.'),
  child: groupNodeSchema.test(
    'relationship-child-not-empty',
    'Please add at least one condition inside the relationship block.',
    groupHasLeaf,
  ),
});

export const filterValidationSchema = groupNodeSchema
  .nullable()
  .test(
    'not-empty-root',
    'Please add at least one rule, or choose "Without any checks".',
    (value) => {
      if (!value) {
        return true;
      }
      return groupHasLeaf(value);
    },
  )
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
