import {
  ALL_TRIGGER_OPERATIONS,
  type BaseEventTriggerFormInitialData,
  type BaseEventTriggerFormValues,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { getSampleInputPayload } from '@/features/orgs/projects/events/event-triggers/utils/getSampleInputPayload';
import type { RequestTransformation } from '@/utils/hasura-api/generated/schemas';
import {
  isBodyTransform,
  isHeaderWithEnvValue,
} from '@/utils/hasura-api/guards';

const getFormPayloadTransform = (
  requestTransform?: RequestTransformation,
): BaseEventTriggerFormValues['payloadTransform'] => {
  if (!requestTransform?.body || !isBodyTransform(requestTransform.body)) {
    return undefined;
  }

  const sampleInput = getSampleInputPayload({});

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

export default function parseEventTriggerFormInitialData(
  eventTrigger: EventTriggerViewModel,
): BaseEventTriggerFormInitialData {
  const webhook = eventTrigger.webhook_from_env
    ? `{{${eventTrigger.webhook_from_env}}}`
    : (eventTrigger.webhook ?? '');

  const { definition } = eventTrigger;
  const triggerOperations = ALL_TRIGGER_OPERATIONS.filter((op) => {
    switch (op) {
      case 'insert':
        return !!definition.insert;
      case 'update':
        return !!definition.update;
      case 'delete':
        return !!definition.delete;
      case 'manual':
        return !!definition.enable_manual;
      default:
        return false;
    }
  });
  const updateTriggerOn = Array.isArray(definition.update?.columns)
    ? 'choose'
    : 'all';
  const updateTriggerColumns =
    updateTriggerOn === 'choose'
      ? (definition.update?.columns as string[])
      : [];

  const headers: BaseEventTriggerFormInitialData['headers'] =
    eventTrigger.headers?.map((header) => {
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

  const requestTransform = eventTrigger.request_transform;

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
  }
  const urlTemplate = requestTransform?.url
    ? requestTransform.url.replace(/^\{\{\$base_url\}\}/, '')
    : '';

  const payloadTransform = getFormPayloadTransform(requestTransform);

  return {
    triggerName: eventTrigger.name,
    dataSource: eventTrigger.dataSource,
    tableName: eventTrigger.table.name,
    tableSchema: eventTrigger.table.schema,
    webhook,
    triggerOperations,
    updateTriggerOn,
    updateTriggerColumns,
    retryConf: {
      numRetries: eventTrigger.retry_conf.num_retries ?? 0,
      intervalSec: eventTrigger.retry_conf.interval_sec ?? 10,
      timeoutSec: eventTrigger.retry_conf.timeout_sec ?? 60,
    },
    headers,
    sampleContext: [],
    requestTransform: {
      urlTemplate,
      method: requestTransform?.method ?? 'POST',
      queryParams,
    },
    payloadTransform,
  };
}
