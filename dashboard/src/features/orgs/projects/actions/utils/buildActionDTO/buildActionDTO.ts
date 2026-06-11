import type { BaseActionFormValues } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import type { ClientCustomType } from '@/features/orgs/projects/actions/utils/customTypesUtils';
import {
  hydrateTypeRelationships,
  mergeCustomTypes,
  parseCustomTypes,
  reformCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { parseActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/parseActionDefinitionSdl';
import { parseTypesSdl } from '@/features/orgs/projects/actions/utils/parseTypesSdl';
import { buildRequestTransformDTO } from '@/features/orgs/projects/events/common/utils/buildRequestTransformDTO';
import type {
  ActionDefinition,
  ActionItem,
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';

const FORM_OWNED_DEFINITION_KEYS = new Set([
  'handler',
  'output_type',
  'arguments',
  'type',
  'kind',
  'headers',
  'forward_client_headers',
  'timeout',
  'request_transform',
]);

export interface BuildActionDTOParams {
  formValues: BaseActionFormValues;
  /**
   * Custom types currently present in the metadata. The types defined in the
   * form are merged into these because `set_custom_types` replaces the whole
   * set.
   */
  existingCustomTypes: CustomTypes;
  /**
   * The action being edited. Used to preserve definition fields that are not
   * editable in the form (e.g. `ignored_client_headers`, `response_transform`).
   */
  originalAction?: ActionItem;
}

export interface ActionDTO {
  actionArgs: CreateActionArgs;
  customTypesArgs: CustomTypes;
  overlappingTypenames: string[];
}

export default function buildActionDTO({
  formValues,
  existingCustomTypes,
  originalAction,
}: BuildActionDTOParams): ActionDTO {
  const { definition: parsedDefinition, error: definitionError } =
    parseActionDefinitionSdl(formValues.actionDefinitionSdl);
  if (definitionError !== null) {
    throw new Error(definitionError);
  }

  const { types: newTypes, error: typesError } = parseTypesSdl(
    formValues.typesSdl,
  );
  if (typesError !== null) {
    throw new Error(typesError);
  }

  const existingTypes = parseCustomTypes(existingCustomTypes);
  const hydratedTypes = hydrateTypeRelationships(newTypes, existingTypes);
  const { types: mergedTypes, overlappingTypenames } = mergeCustomTypes(
    hydratedTypes,
    existingTypes,
  );

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

  const shouldIncludeRequestTransform =
    !!formValues.requestOptionsTransform || !!formValues.payloadTransform;
  const requestTransform = shouldIncludeRequestTransform
    ? buildRequestTransformDTO(formValues)
    : undefined;

  const passthroughDefinitionFields = Object.fromEntries(
    Object.entries(originalAction?.definition ?? {}).filter(
      ([key]) => !FORM_OWNED_DEFINITION_KEYS.has(key),
    ),
  );

  const definition: ActionDefinition = {
    ...passthroughDefinitionFields,
    handler: formValues.webhook,
    output_type: parsedDefinition.outputType,
    arguments: parsedDefinition.arguments,
    type: parsedDefinition.type,
    ...(parsedDefinition.type === 'mutation' ? { kind: formValues.kind } : {}),
    headers,
    forward_client_headers: formValues.forwardClientHeaders,
    timeout: formValues.timeout,
    ...(shouldIncludeRequestTransform
      ? { request_transform: requestTransform }
      : {}),
  };

  return {
    actionArgs: {
      name: parsedDefinition.name,
      definition,
      ...(formValues.comment ? { comment: formValues.comment } : {}),
    },
    customTypesArgs: reformCustomTypes(mergedTypes),
    overlappingTypenames,
  };
}

export function getOverlappingCustomTypenames(
  typesSdl: string,
  existingCustomTypes: CustomTypes,
  typenamesInUseByAction: string[],
): string[] {
  const { types: newTypes, error } = parseTypesSdl(typesSdl);
  if (error !== null) {
    return [];
  }

  const inUseByAction = new Set(typenamesInUseByAction);
  const existingTypenames = new Set(
    parseCustomTypes(existingCustomTypes).map(
      (type: ClientCustomType) => type.name,
    ),
  );

  return newTypes
    .map((type) => type.name)
    .filter(
      (typename) =>
        existingTypenames.has(typename) && !inUseByAction.has(typename),
    );
}
