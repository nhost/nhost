import type { LogicalModelType } from '@/utils/hasura-api/generated/schemas';

export default function formatLogicalModelType(type: LogicalModelType): string {
  if ('scalar' in type) {
    return `${type.scalar}${type.nullable ? ' | null' : ''}`;
  }

  if ('logical_model' in type) {
    return `${type.logical_model}${type.nullable ? ' | null' : ''}`;
  }

  const item = formatLogicalModelType(type.array);
  return `${item.includes(' | null') ? `(${item})` : item}[]${
    type.nullable ? ' | null' : ''
  }`;
}
