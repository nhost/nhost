import { z } from 'zod';

export const headerTypes = [
  {
    label: 'Value',
    value: 'fromValue',
  },
  {
    label: 'Env Var',
    value: 'fromEnv',
  },
] as const;

export const triggerOperations = [
  'insert',
  'update',
  'delete',
  'manual',
] as const;

export const updateTriggerOnOptions = ['all', 'choose'] as const;

export const requestTransformMethods = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

export const requestTransformQueryParamsTypeOptions = [
  'Key Value',
  'URL string template',
] as const;

export const validationSchema = z
  .object({
    triggerName: z
      .string()
      .min(1, { message: 'Trigger name is required' })
      .max(42, { message: 'Trigger name must be at most 42 characters' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message:
          'Trigger name can only contain alphanumeric characters, underscores, and hyphens',
      }),
    dataSource: z.string({ required_error: 'Data source is required' }),
    tableName: z.string({ required_error: 'Table name is required' }),
    tableSchema: z.string({ required_error: 'Schema name is required' }),
    webhook: z.string().min(1, { message: 'Webhook is required' }),
    triggerOperations: z
      .array(z.enum(triggerOperations))
      .refine((value) => value.some((item) => item), {
        message: 'At least one trigger operation is required',
      }),
    updateTriggerOn: z.enum(updateTriggerOnOptions).optional(),
    updateTriggerColumns: z.array(z.string()),
    retryConf: z.object({
      numRetries: z.coerce.number().min(0).default(0),
      intervalSec: z.coerce.number().min(0).default(10),
      timeoutSec: z.coerce.number().min(0).default(60),
    }),
    headers: z.array(
      z.object({
        name: z.string().min(1),
        type: z.enum(
          headerTypes.map((header) => header.value) as [
            (typeof headerTypes)[number]['value'],
          ],
        ),
        value: z.string().min(1),
      }),
    ),
    requestTransform: z
      .object({
        method: z.enum(requestTransformMethods),
        urlTemplate: z.string().optional(),
        queryParams: z.discriminatedUnion('queryParamsType', [
          z.object({
            queryParamsType: z.literal(
              requestTransformQueryParamsTypeOptions[0],
            ),
            queryParams: z.array(
              z.object({
                key: z.string(),
                value: z.string(),
              }),
            ),
          }),
          z.object({
            queryParamsType: z.literal(
              requestTransformQueryParamsTypeOptions[1],
            ),
            queryParamsURL: z.string(),
          }),
        ]),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.updateTriggerOn === 'choose') {
        return (data.updateTriggerColumns?.length ?? 0) > 0;
      }
      return true;
    },
    {
      message: 'At least one column is required for update trigger',
      path: ['updateTriggerColumns'],
    },
  );

export type CreateEventTriggerFormValues = z.infer<typeof validationSchema>;
