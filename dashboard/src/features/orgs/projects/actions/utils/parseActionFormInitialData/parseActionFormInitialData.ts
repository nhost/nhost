import type { BaseActionFormInitialData } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { composeActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/composeActionDefinitionSdl';
import { composeTypesSdl } from '@/features/orgs/projects/actions/utils/composeTypesSdl';
import { DEFAULT_ACTION_TIMEOUT_SECONDS } from '@/features/orgs/projects/actions/utils/constants';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { getActionSampleInputPayload } from '@/features/orgs/projects/actions/utils/getActionSampleInputPayload';
import { parseRequestTransform } from '@/features/orgs/projects/events/common/utils/parseRequestTransform';
import type {
  ActionItem,
  CustomTypes,
  ResponseTransformation,
} from '@/utils/hasura-api/generated/schemas';
import {
  isBodyTransform,
  isHeaderWithEnvValue,
} from '@/utils/hasura-api/guards';

const getFormResponseTransform = (
  responseTransform?: ResponseTransformation,
): BaseActionFormInitialData['responseTransform'] => {
  if (
    !responseTransform?.body ||
    !isBodyTransform(responseTransform.body) ||
    responseTransform.body.action !== 'transform'
  ) {
    return undefined;
  }

  return {
    template: responseTransform.body.template ?? '',
  };
};

export interface ParsedActionFormInitialData {
  initialData: BaseActionFormInitialData;
  originalTypeNames: string[];
}

export default function parseActionFormInitialData(
  action: ActionItem,
  customTypes: CustomTypes,
): ParsedActionFormInitialData {
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

  const sampleInput = getActionSampleInputPayload({
    name: action.name,
    arguments: action.definition.arguments,
  });
  const { requestOptionsTransform, payloadTransform } = parseRequestTransform({
    requestTransform: action.definition.request_transform,
    sampleInput,
  });
  const responseTransform = getFormResponseTransform(
    action.definition.response_transform,
  );

  const actionTypes = getActionTypes(
    action.definition,
    parseCustomTypes(customTypes),
  );

  const initialData: BaseActionFormInitialData = {
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
    ...(responseTransform ? { responseTransform } : {}),
  };

  return {
    initialData,
    originalTypeNames: actionTypes.map((type) => type.name),
  };
}
