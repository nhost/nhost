import type { RemoteField } from '@/utils/hasura-api/generated/schemas';

export default function getRemoteFieldPath(
  remoteField?: RemoteField,
): string[] {
  if (!remoteField) {
    return [];
  }

  const keys = Object.keys(remoteField);

  if (keys.length === 0) {
    return [];
  }

  const head = keys[0];
  const nestedField = remoteField[head]?.field as RemoteField | undefined;

  return [head, ...getRemoteFieldPath(nestedField)];
}
