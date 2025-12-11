import {
  DEFAULT_NUM_RETRIES,
  DEFAULT_RETRY_INTERVAL_SECONDS,
  DEFAULT_RETRY_TIMEOUT_SECONDS,
  DEFAULT_TOLERANCE_SECONDS,
} from '@/features/orgs/projects/events/cron-triggers/constants';
import { getCronTriggerSampleInputPayload } from '@/features/orgs/projects/events/cron-triggers/utils/getCronTriggerSampleInputPayload';
import { isJSONString } from '@/lib/utils';
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

export const frequentlyUsedCrons = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily at midnight (UTC)', value: '0 0 * * *' },
  { label: 'Weekdays at 9am (UTC)', value: '0 9 * * 1-5' },
  { label: 'First of month at midnight (UTC)', value: '0 0 1 * *' },
] as const;

export const validationSchema = z.object({
  triggerName: z
    .string({ required_error: 'Cron trigger name required' })
    .min(1, { message: 'Cron trigger name required' }),
  comment: z.string().optional(),
  webhook: z.string().min(1, { message: 'Webhook URL required' }),
  schedule: z
    .string()
    .min(1, { message: 'Schedule (cron expression) required' }),
  payload: z
    .string()
    .min(1, { message: 'Payload required' })
    .refine((arg: string) => isJSONString(arg), {
      message: 'Payload must be valid json',
    }),
  retryConf: z.object({
    numRetries: z.coerce.number().min(0),
    intervalSec: z.coerce.number().min(0),
    timeoutSec: z.coerce.number().min(0),
    toleranceSec: z.coerce.number().min(0),
  }),
  headers: z.array(
    z.object({
      name: z.string().min(1, 'Name is required'),
      type: z.enum(
        cronHeaderTypes.map((header) => header.value) as [
          (typeof cronHeaderTypes)[number]['value'],
        ],
      ),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
  includeInMetadata: z.boolean().default(true),
  sampleContext: z.array(
    z.object({
      key: z.string().min(1, 'Key is required'),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
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

export const defaultRequestOptionsTransformValues: NonNullable<
  BaseCronTriggerFormValues['requestOptionsTransform']
> = {
  method: undefined,
  urlTemplate: '',
  queryParams: {
    queryParamsType: 'Key Value',
    queryParams: [],
  },
};

export const defaultPayloadTransformValues: NonNullable<
  BaseCronTriggerFormValues['payloadTransform']
> = {
  sampleInput: getCronTriggerSampleInputPayload(),
  requestBodyTransform: {
    requestBodyTransformType: 'application/json',
    template: `{
  "table": {
    "name": {{$body.table.name}},
    "schema": {{$body.table.schema}}
  }
}`,
  },
};

export const defaultFormValues: BaseCronTriggerFormValues = {
  triggerName: '',
  comment: '',
  webhook: '',
  schedule: '',
  retryConf: {
    numRetries: DEFAULT_NUM_RETRIES,
    intervalSec: DEFAULT_RETRY_INTERVAL_SECONDS,
    timeoutSec: DEFAULT_RETRY_TIMEOUT_SECONDS,
    toleranceSec: DEFAULT_TOLERANCE_SECONDS,
  },
  payload: '',
  includeInMetadata: true,
  headers: [],
  sampleContext: [],
  requestOptionsTransform: undefined,
  payloadTransform: undefined,
};

export type BaseCronTriggerFormValues = z.infer<typeof validationSchema>;

export type BaseCronTriggerFormInitialData = BaseCronTriggerFormValues;

export interface BaseCronTriggerFormTriggerProps {
  open: () => void;
}
