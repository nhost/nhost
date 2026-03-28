import { buildRequestTransformDTO } from '@/features/orgs/projects/events/common/utils/buildRequestTransformDTO';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { isNotEmptyValue } from '@/lib/utils';
import type {
  CreateCronTriggerArgs,
  RetryConfCT,
} from '@/utils/hasura-api/generated/schemas';

export interface BuildCronTriggerDTOParams {
  formValues: BaseCronTriggerFormValues;
  isEdit?: boolean;
}

export default function buildCronTriggerDTO({
  formValues,
  isEdit = false,
}: BuildCronTriggerDTOParams): CreateCronTriggerArgs {
  let payload: Record<string, unknown>;
  try {
    payload = isNotEmptyValue(formValues.payload)
      ? JSON.parse(formValues.payload)
      : {};
  } catch (_) {
    throw new Error(
      'Could not parse payload. Please enter a valid JSON string.',
    );
  }

  const headers = formValues.headers.map((header) => {
    if (header.type === 'fromEnv') {
      return {
        name: header.name,
        value_from_env: header.value,
      };
    }
    return {
      name: header.name,
      value: header.value,
    };
  });

  const retry_conf: RetryConfCT = {
    num_retries: formValues.retryConf.numRetries,
    retry_interval_seconds: formValues.retryConf.intervalSec,
    timeout_seconds: formValues.retryConf.timeoutSec,
    tolerance_seconds: formValues.retryConf.toleranceSec,
  };

  const shouldIncludeRequestTransform =
    !!formValues.requestOptionsTransform || !!formValues.payloadTransform;
  const request_transform = shouldIncludeRequestTransform
    ? buildRequestTransformDTO(formValues)
    : undefined;

  return {
    name: formValues.triggerName,
    ...(formValues.comment ? { comment: formValues.comment } : {}),
    webhook: formValues.webhook,
    schedule: formValues.schedule,
    payload,
    headers,
    retry_conf,
    include_in_metadata: true,
    ...(isEdit ? { replace: true } : {}),
    ...(shouldIncludeRequestTransform ? { request_transform } : {}),
  };
}
