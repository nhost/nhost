import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { buildRequestTransformDTO } from '@/features/orgs/projects/events/event-triggers/utils/buildRequestTransformDTO';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';

export interface BuildWebhookTransformDTOParams {
  formValues: BaseEventTriggerFormValues;
}

export default function buildTestWebhookTransformDTO({
  formValues,
}: BuildWebhookTransformDTOParams): TestWebhookTransformArgs {
  let body = {};
  try {
    body = formValues.payloadTransform?.sampleInput
      ? JSON.parse(formValues.payloadTransform.sampleInput)
      : null;
  } catch {
    throw new Error('Invalid sample input. Please enter a valid JSON string.');
  }

  const env = formValues.sampleContext.reduce((acc, item) => {
    // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
    acc[item.key] = item.value;
    return acc;
  }, {});

  const requestTransform = buildRequestTransformDTO(formValues);

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
