import { buildRequestTransformDTO } from '@/features/orgs/projects/events/common/utils/buildRequestTransformDTO';
import type { RequestTransformFormValues } from '@/features/orgs/projects/events/common/utils/buildRequestTransformDTO';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';

export interface WebhookTransformFormValues extends RequestTransformFormValues {
  webhook: string;
  sampleContext: Array<{ key: string; value: string }>;
}

export interface BuildTestWebhookTransformDTOParams {
  formValues: WebhookTransformFormValues;
}

export default function buildTestWebhookTransformDTO({
  formValues,
}: BuildTestWebhookTransformDTOParams): TestWebhookTransformArgs {
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
