import { z } from 'zod';
import type {
  AddComputedFieldArgs,
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const optionalIdentifier = z
  .string()
  .trim()
  .refine((value) => value === '' || identifierPattern.test(value), {
    message: 'Must be a valid identifier (letters, digits, underscores).',
  });

export const computedFieldValidationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Computed field name is required.')
    .regex(
      identifierPattern,
      'Must be a valid identifier (letters, digits, underscores).',
    ),
  functionSchema: z.string().trim().min(1, 'Function schema is required.'),
  functionName: z.string().trim().min(1, 'Function name is required.'),
  tableArgument: optionalIdentifier,
  sessionArgument: optionalIdentifier,
  comment: z.string(),
});

export type ComputedFieldFormValues = z.infer<
  typeof computedFieldValidationSchema
>;

export const defaultComputedFieldValues: ComputedFieldFormValues = {
  name: '',
  functionSchema: '',
  functionName: '',
  tableArgument: '',
  sessionArgument: '',
  comment: '',
};

export function computedFieldItemToFormValues(
  item: ComputedFieldItem,
): ComputedFieldFormValues {
  return {
    name: item.name,
    functionSchema: item.definition.function.schema,
    functionName: item.definition.function.name,
    tableArgument: item.definition.table_argument ?? '',
    sessionArgument: item.definition.session_argument ?? '',
    comment: item.comment ?? '',
  };
}

export function formValuesToAddComputedFieldArgs(
  values: ComputedFieldFormValues,
  table: QualifiedTable,
  source: string,
): AddComputedFieldArgs {
  const args: AddComputedFieldArgs = {
    table,
    name: values.name.trim(),
    definition: {
      function: {
        schema: values.functionSchema,
        name: values.functionName,
      },
    },
    source,
  };

  const trimmedTableArgument = values.tableArgument.trim();
  if (trimmedTableArgument) {
    args.definition.table_argument = trimmedTableArgument;
  }

  const trimmedSessionArgument = values.sessionArgument.trim();
  if (trimmedSessionArgument) {
    args.definition.session_argument = trimmedSessionArgument;
  }

  const trimmedComment = values.comment.trim();
  if (trimmedComment) {
    args.comment = trimmedComment;
  }

  return args;
}
