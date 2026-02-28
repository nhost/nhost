import { z } from 'zod';
import {
  DEFAULT_NUM_RETRIES,
  DEFAULT_RETRY_INTERVAL_SECONDS,
  DEFAULT_RETRY_TIMEOUT_SECONDS,
  DEFAULT_TOLERANCE_SECONDS,
  requestOptionsTransformQueryParamsTypeOptions,
  requestTransformMethods,
} from '@/features/orgs/projects/events/common/constants';
import { getCronTriggerSampleInputPayload } from '@/features/orgs/projects/events/cron-triggers/utils/getCronTriggerSampleInputPayload';
import { isJSONString } from '@/lib/utils';

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

export {
  requestOptionsTransformQueryParamsTypeOptions as cronRequestOptionsTransformQueryParamsTypeOptions,
  requestTransformMethods as cronRequestTransformMethods,
} from '@/features/orgs/projects/events/common/constants';

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
  sampleContext: z.array(
    z.object({
      key: z.string().min(1, 'Key is required'),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
  requestOptionsTransform: z
    .object({
      method: z.enum(requestTransformMethods).optional(),
      urlTemplate: z.string().optional(),
      queryParams: z.discriminatedUnion('queryParamsType', [
        z.object({
          queryParamsType: z.literal(
            requestOptionsTransformQueryParamsTypeOptions[0],
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
            requestOptionsTransformQueryParamsTypeOptions[1],
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
  "payload": {{$body.payload}}
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
  headers: [],
  sampleContext: [],
  requestOptionsTransform: undefined,
  payloadTransform: undefined,
};

export type BaseCronTriggerFormValues = z.infer<typeof validationSchema>;

export type BaseCronTriggerFormInitialData = BaseCronTriggerFormValues;
