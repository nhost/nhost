import { z } from 'zod';
import { getGraphQLIdentifierSchema } from '@/features/orgs/projects/common/utils/getGraphQLIdentifierSchema';
import { postgresTypeGroups } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/types';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/createEmptyTypeNode';

export const postgresTypeOptions = postgresTypeGroups.map(
  ({ group, label, value }) => ({
    group,
    label,
    value: label,
    keywords: [value],
  }),
);

const typeSchema: z.ZodType<LogicalModelTypeNode> = z.discriminatedUnion(
  'kind',
  [
    z.object({
      kind: z.literal('scalar'),
      scalar: z.string().trim().min(1, 'Select or enter a scalar type.'),
      nullable: z.boolean(),
    }),
    z.object({
      kind: z.literal('logical_model'),
      logicalModel: z.string().trim().min(1, 'Select a logical model.'),
      nullable: z.boolean(),
    }),
    z.object({
      kind: z.literal('array'),
      item: z.lazy(() => typeSchema),
      nullable: z.boolean(),
    }),
  ],
);

function createLogicalModelBaseSchema() {
  return z.object({
    name: getGraphQLIdentifierSchema('Name', 'Name is required.'),
    description: z.string(),
    fields: z.array(
      z.object({
        name: getGraphQLIdentifierSchema(
          'Field name',
          'Field name is required.',
        ),
        type: typeSchema,
        description: z.string(),
      }),
    ),
  });
}

export const createLogicalModelFormSchema = () =>
  createLogicalModelBaseSchema().superRefine((values, context) => {
    const fieldNames = new Set<string>();
    values.fields.forEach((field, index) => {
      if (fieldNames.has(field.name)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', index, 'name'],
          message: 'Field names must be unique.',
        });
      }
      fieldNames.add(field.name);
    });
  });

export const defaultValues: LogicalModelFormValues = {
  name: '',
  description: '',
  fields: [{ name: '', type: createEmptyTypeNode(), description: '' }],
};

interface ErrorMessage {
  message?: string;
}

export interface TypeNodeError extends ErrorMessage {
  scalar?: ErrorMessage;
  logicalModel?: ErrorMessage;
  item?: TypeNodeError;
}

export interface BaseLogicalModelFormProps {
  values?: LogicalModelFormValues;
  originalName?: string;
  logicalModelNames: string[];
  isPending: boolean;
  onSubmit: (values: LogicalModelFormValues) => Promise<void> | void;
  onCancel: (event?: unknown) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  isDrawer?: boolean;
}
