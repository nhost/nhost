import type { InputArgument } from '@/utils/hasura-api/generated/schemas';

export interface GetActionSampleInputPayloadParams {
  name: string;
  arguments?: InputArgument[];
}

export default function getActionSampleInputPayload(
  definition?: GetActionSampleInputPayloadParams,
): string {
  const input = Object.fromEntries(
    (definition?.arguments ?? []).map((argument) => [
      argument.name,
      'sample_value',
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
