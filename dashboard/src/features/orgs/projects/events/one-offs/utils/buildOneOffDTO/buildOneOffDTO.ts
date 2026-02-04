import type { CreateOneOffFormValues } from '@/features/orgs/projects/events/one-offs/components/CreateOneOffForm/CreateOneOffForm';
import { isNotEmptyValue } from '@/lib/utils';
import type {
  CreateScheduledEventArgs,
  RetryConfCT,
} from '@/utils/hasura-api/generated/schemas';

export default function buildOneOffDTO(
  formValues: CreateOneOffFormValues,
): CreateScheduledEventArgs {
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
  };

  return {
    ...(formValues.comment ? { comment: formValues.comment } : {}),
    webhook: formValues.webhook,
    schedule_at: formValues.scheduleAt,
    payload,
    headers,
    retry_conf,
  };
}
