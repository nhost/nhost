import { z } from 'zod';

export const cronHeaderTypes = [
  {
    label: 'Value',
    value: 'fromValue',
  },
  {
    label: 'Env Var',
    value: 'fromEnv',
  },
] as const;

export const cronRequestTransformMethods = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

export const cronRequestOptionsTransformQueryParamsTypeOptions = [
  'Key Value',
  'URL string template',
] as const;

export const cronValidationSchema = z.object({
  triggerName: z
    .string({ required_error: 'Trigger name required' })
    .min(1, { message: 'Trigger name required' })
    .max(42, { message: 'Trigger name must be at most 42 characters' })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        'Trigger name can only contain alphanumeric characters, underscores, and hyphens',
    }),
  webhook: z.string().min(1, { message: 'Webhook URL required' }),
  schedule: z
    .string()
    .min(1, { message: 'Schedule (cron expression) required' }),
  payload: z.any().optional(),
  headers: z
    .array(
      z.object({
        name: z.string().min(1, 'Name is required'),
        type: z.enum(
          cronHeaderTypes.map((header) => header.value) as [
            (typeof cronHeaderTypes)[number]['value'],
          ],
        ),
        value: z.string().min(1, 'Value is required'),
      }),
    )
    .optional(),
  retryConf: z
    .object({
      numRetries: z.coerce.number().min(0),
      intervalSec: z.coerce.number().min(0),
      timeoutSec: z.coerce.number().min(0),
    })
    .optional(),
  includeInMetadata: z.boolean().default(false),
  comment: z.string().optional(),
  requestOptionsTransform: z
    .object({
      method: z.enum(cronRequestTransformMethods).optional(),
      urlTemplate: z.string().optional(),
      queryParams: z.discriminatedUnion('queryParamsType', [
        z.object({
          queryParamsType: z.literal(
            cronRequestOptionsTransformQueryParamsTypeOptions[0],
          ),
          queryParams: z.array(
            z.object({
              key: z.string().min(1, 'Key is required'),
              value: z.string().min(1, 'Value is required'),
            }),
          ),
        }),
        z.object({
          queryParamsType: z.literal(
            cronRequestOptionsTransformQueryParamsTypeOptions[1],
          ),
          queryParamsURL: z.string(),
        }),
      ]),
    })
    .optional(),
  payloadTransform: z
    .object({
      sampleInput: z.string(),
      requestBodyTransform: z.discriminatedUnion('requestBodyTransformType', [
        z.object({
          requestBodyTransformType: z.literal('disabled'),
        }),
        z.object({
          requestBodyTransformType: z.literal('application/json'),
          template: z.string(),
        }),
        z.object({
          requestBodyTransformType: z.literal(
            'application/x-www-form-urlencoded',
          ),
          formTemplate: z.array(
            z.object({
              key: z.string().min(1, 'Key is required'),
              value: z.string().min(1, 'Value is required'),
            }),
          ),
        }),
      ]),
    })
    .optional(),
});

export type BaseCronTriggerFormValues = z.infer<typeof cronValidationSchema>;
export type BaseCronTriggerFormInitialData = BaseCronTriggerFormValues;

export interface BaseCronTriggerFormTriggerProps {
  open: () => void;
}
