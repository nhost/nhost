import { getSampleInputPayload } from '@/features/orgs/projects/events/event-triggers/utils/getSampleInputPayload';
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

export const ALL_TRIGGER_OPERATIONS = [
  'insert',
  'update',
  'delete',
  'manual',
] as const;

export type TriggerOperation = (typeof ALL_TRIGGER_OPERATIONS)[number];

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
      .string({ required_error: 'Trigger name is required' })
      .min(1, { message: 'Trigger name is required' })
      .max(42, { message: 'Trigger name must be at most 42 characters' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message:
          'Trigger name can only contain alphanumeric characters, underscores, and hyphens',
      }),
    dataSource: z
      .string({ required_error: 'Data source is required' })
      .min(1, { message: 'Data source is required' }),
    tableName: z
      .string({ required_error: 'Table name is required' })
      .min(1, { message: 'Table name is required' }),
    tableSchema: z
      .string({ required_error: 'Schema required' })
      .min(1, { message: 'Schema is required' }),
    webhook: z.string().min(1, { message: 'Webhook is required' }),
    triggerOperations: z
      .array(z.enum(ALL_TRIGGER_OPERATIONS))
      .refine((value) => value.some((item) => item), {
        message: 'At least one trigger operation is required',
      }),
    updateTriggerOn: z.enum(updateTriggerOnOptions).optional(),
    updateTriggerColumns: z.array(z.string()).optional(),
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
    sampleContext: z.array(
      z.object({
        key: z.string().min(1),
        value: z.string().min(1),
      }),
    ),
    requestOptionsTransform: z
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
                key: z.string(),
                value: z.string(),
              }),
            ),
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

export const defaultRequestOptionsTransformValues: NonNullable<
  BaseEventTriggerFormValues['requestOptionsTransform']
> = {
  method: 'POST',
  urlTemplate: '',
  queryParams: {
    queryParamsType: 'Key Value',
    queryParams: [],
  },
};

export const defaultPayloadTransformValues: NonNullable<
  BaseEventTriggerFormValues['payloadTransform']
> = {
  sampleInput: getSampleInputPayload({}),
  requestBodyTransform: {
    requestBodyTransformType: 'application/json',
    template: JSON.stringify(
      {
        table: {
          name: `{{$body.table.name}}`,
          schema: `{{$body.table.schema}}`,
        },
      },
      null,
      2,
    ),
  },
};

export const defaultFormValues: BaseEventTriggerFormValues = {
  triggerName: '',
  dataSource: '',
  tableName: '',
  tableSchema: '',
  webhook: '',
  triggerOperations: [],
  updateTriggerOn: 'all',
  updateTriggerColumns: [],
  retryConf: {
    numRetries: 0,
    intervalSec: 10,
    timeoutSec: 60,
  },
  headers: [],
  sampleContext: [],
  requestOptionsTransform: undefined,
  payloadTransform: undefined,
};

export type BaseEventTriggerFormValues = z.infer<typeof validationSchema>;

export type BaseEventTriggerFormInitialData = BaseEventTriggerFormValues;
