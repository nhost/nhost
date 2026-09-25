import { z } from 'zod';
import { getGraphQLIdentifierSchema } from '@/features/orgs/projects/common/utils/getGraphQLIdentifierSchema';
import { postgresTypeGroups } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';

export const postgresTypeOptions = postgresTypeGroups.map(
  ({ group, label, value }) => ({
    group,
    label,
    value: label,
    keywords: [value],
  }),
);

function createNativeQueryBaseSchema() {
  return z.object({
    rootFieldName: getGraphQLIdentifierSchema(
      'Root field name',
      'Root field name is required.',
    ),
    description: z.string(),
    returns: z.string().trim().min(1, 'Select a return model.'),
    code: z.string().trim().min(1, 'SQL is required.'),
    arguments: z.array(
      z.object({
        name: getGraphQLIdentifierSchema(
          'Argument name',
          'Argument name is required.',
        ),
        type: z.string().trim().min(1, 'Select or enter an argument type.'),
        nullable: z.boolean(),
        description: z.string(),
      }),
    ),
  });
}

export const createNativeQueryFormSchema = () =>
  createNativeQueryBaseSchema().superRefine((values, context) => {
    const argumentNames = new Set<string>();
    values.arguments.forEach((argument, index) => {
      if (argumentNames.has(argument.name)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['arguments', index, 'name'],
          message: 'Argument names must be unique.',
        });
      }
      argumentNames.add(argument.name);
    });
  });

export const DEFAULT_VALUES: NativeQueryFormValues = {
  rootFieldName: '',
  description: '',
  returns: '',
  code: '',
  arguments: [],
};

export interface BaseNativeQueryFormProps {
  values?: NativeQueryFormValues;
  originalName?: string;
  logicalModelNames: string[];
  isPending: boolean;
  onSubmit: (values: NativeQueryFormValues) => Promise<void> | void;
  onCancel: (event?: unknown) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}
