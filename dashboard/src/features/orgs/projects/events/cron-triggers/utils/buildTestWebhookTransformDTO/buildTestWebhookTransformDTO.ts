import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { buildCronTriggerRequestTransformDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildCronTriggerRequestTransformDTO';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';

export interface BuildWebhookTransformDTOParams {
  formValues: BaseCronTriggerFormValues;
}

export default function buildTestWebhookTransformDTO({
  formValues,
}: BuildWebhookTransformDTOParams): TestWebhookTransformArgs {
  let body = {};
  try {
    body = formValues.payloadTransform?.sampleInput
      ? JSON.parse(formValues.payloadTransform.sampleInput)
      : null;
  } catch (error) {
    throw new Error('Invalid sample input. Please enter a valid JSON string.');
  }

  const env = formValues.sampleContext.reduce((acc, item) => {
    // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
    acc[item.key] = item.value;
    return acc;
  }, {});

  const requestTransform = buildCronTriggerRequestTransformDTO(formValues);

  return {
    webhook_url: formValues.webhook ?? '',
    body,
    env,
    session_variables: {
      'x-hasura-admin-secret': 'xxx',
    },
    request_transform: requestTransform ?? {},
  };
}
