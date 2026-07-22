import type { ClientCustomType } from '@/features/orgs/projects/graphql/actions/utils/customTypesUtils';
import { unwrapType } from '@/features/orgs/projects/graphql/actions/utils/unwrapType';
import type { InputArgument } from '@/utils/hasura-api/generated/schemas';

const sampleIntegerMax = 20;
const maxInputObjectDepth = 5;
const numericTypenames = new Set(['Int', 'Float', 'BigInt']);

type SampleValue =
  | string
  | number
  | boolean
  | SampleValue[]
  | { [key: string]: SampleValue };

function generateSampleValue(
  wrappedType: string,
  name: string,
  typesByName: Map<string, ClientCustomType>,
  depth: number,
): SampleValue {
  const { typename, stack } = unwrapType(wrappedType);

  let value = generateBaseSampleValue(typename, name, typesByName, depth);
  for (const wrapper of stack) {
    if (wrapper === 'l') {
      value = [value];
    }
  }
  return value;
}

function generateBaseSampleValue(
  typename: string,
  name: string,
  typesByName: Map<string, ClientCustomType>,
  depth: number,
): SampleValue {
  if (numericTypenames.has(typename)) {
    return Math.floor(Math.random() * sampleIntegerMax);
  }

  if (typename === 'Boolean') {
    return true;
  }

  const customType = typesByName.get(typename);

  if (customType?.kind === 'enum') {
    return customType.values?.[0]?.value ?? name;
  }

  if (customType?.kind === 'input_object') {
    if (depth >= maxInputObjectDepth) {
      return {};
    }
    return Object.fromEntries(
      (customType.fields ?? []).map((field) => [
        field.name,
        generateSampleValue(field.type, field.name, typesByName, depth + 1),
      ]),
    );
  }

  return name;
}

export interface GetActionSampleInputPayloadParams {
  name: string;
  arguments?: InputArgument[];
}

export default function getActionSampleInputPayload(
  definition?: GetActionSampleInputPayloadParams,
  types: ClientCustomType[] = [],
): string {
  const typesByName = new Map(types.map((type) => [type.name, type]));

  const input = Object.fromEntries(
    (definition?.arguments ?? []).map((argument) => [
      argument.name,
      generateSampleValue(argument.type, argument.name, typesByName, 0),
    ]),
  );

  const obj = {
    action: {
      name: definition?.name ?? 'actionName',
    },
    input,
    session_variables: {
      'x-hasura-role': 'user',
    },
    request_query: '',
  };

  return JSON.stringify(obj, null, 2);
}
