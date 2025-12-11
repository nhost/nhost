import type {
  BaseCronTriggerFormInitialData,
  BaseCronTriggerFormValues,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import {
  DEFAULT_NUM_RETRIES,
  DEFAULT_RETRY_INTERVAL_SECONDS,
  DEFAULT_RETRY_TIMEOUT_SECONDS,
  DEFAULT_TOLERANCE_SECONDS,
} from '@/features/orgs/projects/events/cron-triggers/constants';
import { getCronTriggerSampleInputPayload } from '@/features/orgs/projects/events/cron-triggers/utils/getCronTriggerSampleInputPayload';
import { isNotEmptyValue } from '@/lib/utils';
import type {
  CronTrigger,
  RequestTransformation,
} from '@/utils/hasura-api/generated/schemas';
import {
  isBodyTransform,
  isHeaderWithEnvValue,
} from '@/utils/hasura-api/guards';

const getRequestOptionsTransform = (
  requestTransform?: RequestTransformation,
): BaseCronTriggerFormValues['requestOptionsTransform'] => {
  if (!requestTransform) {
    return undefined;
  }

  let queryParams;
  if (typeof requestTransform?.query_params === 'string') {
    queryParams = {
      queryParamsType: 'URL string template',
      queryParamsURL: requestTransform.query_params,
    };
  } else if (typeof requestTransform?.query_params === 'object') {
    queryParams = {
      queryParamsType: 'Key Value',
      queryParams: Object.entries(requestTransform.query_params).map(
        ([key, value]) => ({
          key,
          value,
        }),
      ),
    };
  } else {
    return undefined;
  }
  const urlTemplate = requestTransform?.url
    ? requestTransform.url.replace(/^\{\{\$base_url\}\}/, '')
    : '';

  return {
    urlTemplate,
    method: requestTransform?.method ?? 'POST',
    queryParams,
  };
};

const getFormPayloadTransform = (
  requestTransform?: RequestTransformation,
): BaseCronTriggerFormValues['payloadTransform'] => {
  if (!requestTransform?.body || !isBodyTransform(requestTransform.body)) {
    return undefined;
  }

  const sampleInput = getCronTriggerSampleInputPayload();

  switch (requestTransform.body.action) {
    case 'remove':
      return {
        requestBodyTransform: {
          requestBodyTransformType: 'disabled',
        },
        sampleInput,
      };
    case 'transform':
      return {
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template: requestTransform.body.template ?? '',
        },
        sampleInput,
      };
    case 'x_www_form_urlencoded':
      return {
        requestBodyTransform: {
          requestBodyTransformType: 'application/x-www-form-urlencoded',
          formTemplate: Object.entries(
            requestTransform.body.form_template ?? {},
          ).map(([key, value]) => ({
            key,
            value,
          })),
        },
        sampleInput,
      };
    default: {
      const exhaustive: never = requestTransform.body.action;
      throw new Error(`Unexpected request body transform type: ${exhaustive}`);
    }
  }
};

export default function parseCronTriggerFormInitialData(
  cronTrigger: CronTrigger,
): BaseCronTriggerFormInitialData {
  let parsedPayload: string;
  try {
    parsedPayload = isNotEmptyValue(cronTrigger.payload)
      ? JSON.stringify(cronTrigger.payload, null, 2)
      : '{}';
  } catch (error) {
    parsedPayload = '{}';
  }

  const headers: BaseCronTriggerFormInitialData['headers'] =
    cronTrigger.headers?.map((header) => {
      if (isHeaderWithEnvValue(header)) {
        return {
          name: header.name,
          type: 'fromEnv',
          value: header.value_from_env,
        };
      }
      return {
        name: header.name,
        type: 'fromValue',
        value: header.value,
      };
    }) ?? [];

  const requestTransform = cronTrigger.request_transform;

  const requestOptionsTransform = getRequestOptionsTransform(requestTransform);

  const payloadTransform = getFormPayloadTransform(requestTransform);

  return {
    triggerName: cronTrigger.name,
    webhook: cronTrigger.webhook,
    schedule: cronTrigger.schedule,
    payload: parsedPayload,
    comment: cronTrigger.comment ?? '',
    retryConf: {
      numRetries: cronTrigger.retry_conf?.num_retries ?? DEFAULT_NUM_RETRIES,
      intervalSec:
        cronTrigger.retry_conf?.retry_interval_seconds ??
        DEFAULT_RETRY_INTERVAL_SECONDS,
      timeoutSec:
        cronTrigger.retry_conf?.timeout_seconds ??
        DEFAULT_RETRY_TIMEOUT_SECONDS,
      toleranceSec:
        cronTrigger.retry_conf?.tolerance_seconds ?? DEFAULT_TOLERANCE_SECONDS,
    },
    headers,
    sampleContext: [],
    ...(requestOptionsTransform ? { requestOptionsTransform } : {}),
    ...(payloadTransform ? { payloadTransform } : {}),
  };
}
