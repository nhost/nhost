import { z } from 'zod';
import {
  requestOptionsTransformQueryParamsTypeOptions,
  requestTransformMethods,
} from '@/features/orgs/projects/events/common/constants';
import {
  DEFAULT_ACTION_DEFINITION_SDL,
  DEFAULT_ACTION_TIMEOUT_SECONDS,
  DEFAULT_ACTION_TYPES_SDL,
} from '@/features/orgs/projects/graphql/actions/utils/constants';
import { parseActionDefinitionSdl } from '@/features/orgs/projects/graphql/actions/utils/parseActionDefinitionSdl';
import { parseTypesSdl } from '@/features/orgs/projects/graphql/actions/utils/parseTypesSdl';

export const actionKindOptions = [
  {
    label: 'Synchronous',
    value: 'synchronous',
  },
  {
    label: 'Asynchronous',
    value: 'asynchronous',
  },
] as const;

export function createValidationSchema(lockedActionName?: string) {
  return z.object({
    actionDefinitionSdl: z
      .string()
      .min(1, { message: 'Action definition is required' })
      .superRefine((sdl, ctx) => {
        const { definition, error } = parseActionDefinitionSdl(sdl);
        if (error !== null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
          return;
        }
        if (lockedActionName && definition.name !== lockedActionName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Renaming an action is not supported. Create a new action instead.',
          });
        }
      }),
    typesSdl: z.string().superRefine((sdl, ctx) => {
      const { error } = parseTypesSdl(sdl);
      if (error !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }
    }),
    webhook: z.string().min(1, { message: 'Webhook URL is required' }),
    kind: z.enum(
      actionKindOptions.map((option) => option.value) as [
        (typeof actionKindOptions)[number]['value'],
      ],
    ),
    comment: z.string().optional(),
    timeout: z.coerce.number().min(0),
    forwardClientHeaders: z.boolean(),
    headers: z.array(
      z.object({
        name: z.string().min(1, 'Name is required'),
        type: z.enum(['fromValue', 'fromEnv']),
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
    responseTransform: z
      .object({
        template: z.string(),
      })
      .optional(),
  });
}

export const validationSchema = createValidationSchema();

export type BaseActionFormValues = z.infer<typeof validationSchema>;

export type BaseActionFormInitialData = BaseActionFormValues;

export const defaultRequestOptionsTransformValues: NonNullable<
  BaseActionFormValues['requestOptionsTransform']
> = {
  method: undefined,
  urlTemplate: '',
  queryParams: {
    queryParamsType: 'Key Value',
    queryParams: [],
  },
};

export const defaultPayloadTransformValues: NonNullable<
  BaseActionFormValues['payloadTransform']
> = {
  // Always overridden with the payload derived from the current action
  // definition when the section is enabled.
  sampleInput: '',
  requestBodyTransform: {
    requestBodyTransformType: 'application/json',
    template: `{
  "input": {{$body.input}}
}`,
  },
};

export const defaultResponseTransformValues: NonNullable<
  BaseActionFormValues['responseTransform']
> = {
  template: `{
  "field": {{$body.field}}
}`,
};

export const defaultFormValues: BaseActionFormValues = {
  actionDefinitionSdl: DEFAULT_ACTION_DEFINITION_SDL,
  typesSdl: DEFAULT_ACTION_TYPES_SDL,
  webhook: '',
  kind: 'synchronous',
  comment: '',
  timeout: DEFAULT_ACTION_TIMEOUT_SECONDS,
  forwardClientHeaders: false,
  headers: [],
  sampleContext: [],
  requestOptionsTransform: undefined,
  payloadTransform: undefined,
  responseTransform: undefined,
};
