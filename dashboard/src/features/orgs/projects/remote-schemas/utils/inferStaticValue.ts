import type { RemoteFieldArguments } from '@/utils/hasura-api/generated/schemas';

type RemoteFieldArgumentValue = RemoteFieldArguments[string];

/**
 * Infer the native type of a static value from its string representation.
 * Converts "true"/"false" to booleans, numeric strings to numbers,
 * and attempts to parse JSON for objects/arrays.
 */
export default function inferStaticValue(
  value: string,
): RemoteFieldArgumentValue {
  const trimmedValue = value.trim();
  if (trimmedValue === '') {
    return '';
  }

  if (trimmedValue === 'true') {
    return true;
  }

  if (trimmedValue === 'false') {
    return false;
  }

  if (!Number.isNaN(Number(trimmedValue)) && trimmedValue !== '') {
    return Number(trimmedValue);
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return trimmedValue;
  }
}
