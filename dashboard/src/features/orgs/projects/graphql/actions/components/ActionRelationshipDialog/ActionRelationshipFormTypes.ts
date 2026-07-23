import { z } from 'zod';
import { getRelationshipNameSchema } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type { ActionRelationship } from '@/features/orgs/projects/graphql/actions/utils/actionRelationships';

const fieldMappingSchema = z.object({
  sourceField: z.string().min(1, { message: 'Source field is required' }),
  referenceColumn: z
    .string()
    .min(1, { message: 'Reference column is required' }),
});

export function createActionRelationshipFormSchema(
  existingNames: string[],
  outputFieldNames: string[],
) {
  const existingNameSet = new Set(existingNames);
  const outputFieldNameSet = new Set(outputFieldNames);

  return z.object({
    name: getRelationshipNameSchema('Name')
      .refine((name) => !existingNameSet.has(name), {
        message: 'A relationship with this name already exists.',
      })
      .refine((name) => !outputFieldNameSet.has(name), {
        message: 'An output field with this name already exists.',
      }),
    type: z.enum(['object', 'array'], {
      required_error: 'Relationship type is required',
    }),
    source: z.string().min(1, { message: 'Source is required' }),
    schema: z.string().min(1, { message: 'Schema is required' }),
    table: z.string().min(1, { message: 'Table is required' }),
    fieldMapping: z
      .array(fieldMappingSchema)
      .min(1, { message: 'At least one field mapping is required' }),
  });
}

export type ActionRelationshipFormValues = z.infer<
  ReturnType<typeof createActionRelationshipFormSchema>
>;

export const defaultActionRelationshipFormValues: ActionRelationshipFormValues =
  {
    name: '',
    type: 'object',
    source: 'default',
    schema: '',
    table: '',
    fieldMapping: [],
  };

export function actionRelationshipToFormValues(
  relationship: ActionRelationship,
): ActionRelationshipFormValues {
  return {
    name: relationship.name,
    type: relationship.type,
    source: relationship.source ?? 'default',
    schema: relationship.remote_table.schema,
    table: relationship.remote_table.name,
    fieldMapping: Object.entries(relationship.field_mapping).map(
      ([sourceField, referenceColumn]) => ({ sourceField, referenceColumn }),
    ),
  };
}

export function formValuesToActionRelationship(
  values: ActionRelationshipFormValues,
): ActionRelationship {
  return {
    source: values.source,
    name: values.name,
    type: values.type,
    remote_table: { schema: values.schema, name: values.table },
    field_mapping: Object.fromEntries(
      values.fieldMapping.map(({ sourceField, referenceColumn }) => [
        sourceField,
        referenceColumn,
      ]),
    ),
  };
}
