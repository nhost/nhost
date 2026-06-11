import type {
  BaseActionFormInitialData,
  BaseActionFormValues,
} from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { composeActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/composeActionDefinitionSdl';
import { composeTypesSdl } from '@/features/orgs/projects/actions/utils/composeTypesSdl';
import { DEFAULT_ACTION_TIMEOUT_SECONDS } from '@/features/orgs/projects/actions/utils/constants';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { getActionSampleInputPayload } from '@/features/orgs/projects/actions/utils/getActionSampleInputPayload';
import type {
  ActionItem,
  CustomTypes,
  RequestTransformation,
} from '@/utils/hasura-api/generated/schemas';
import {
  isBodyTransform,
  isHeaderWithEnvValue,
} from '@/utils/hasura-api/guards';

type QueryParams =
  | {
      queryParams: { value: string; key: string }[];
      queryParamsType: 'Key Value';
    }
  | { queryParamsType: 'URL string template'; queryParamsURL: string };

const getRequestOptionsTransform = (
  requestTransform?: RequestTransformation,
): BaseActionFormValues['requestOptionsTransform'] => {
  if (!requestTransform) {
    return undefined;
  }

  let queryParams: QueryParams;
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
  sampleInput: string,
  requestTransform?: RequestTransformation,
): BaseActionFormValues['payloadTransform'] => {
  if (!requestTransform?.body || !isBodyTransform(requestTransform.body)) {
    return undefined;
  }

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

export default function parseActionFormInitialData(
  action: ActionItem,
  customTypes: CustomTypes,
): BaseActionFormInitialData {
  const headers: BaseActionFormInitialData['headers'] =
    action.definition.headers?.map((header) => {
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

  const requestTransform = action.definition.request_transform;
  const requestOptionsTransform = getRequestOptionsTransform(requestTransform);
  const sampleInput = getActionSampleInputPayload({
    name: action.name,
    arguments: action.definition.arguments,
  });
  const payloadTransform = getFormPayloadTransform(
    sampleInput,
    requestTransform,
  );

  const actionTypes = getActionTypes(
    action.definition,
    parseCustomTypes(customTypes),
  );

  return {
    actionDefinitionSdl: composeActionDefinitionSdl({
      name: action.name,
      definition: action.definition,
    }),
    typesSdl: composeTypesSdl(actionTypes),
    webhook: action.definition.handler,
    kind: action.definition.kind ?? 'synchronous',
    comment: action.comment ?? '',
    timeout: action.definition.timeout ?? DEFAULT_ACTION_TIMEOUT_SECONDS,
    forwardClientHeaders: action.definition.forward_client_headers ?? false,
    headers,
    sampleContext: [],
    ...(requestOptionsTransform ? { requestOptionsTransform } : {}),
    ...(payloadTransform ? { payloadTransform } : {}),
  };
}
