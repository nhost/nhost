import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';
import type { LogicalModelFieldDescriptor } from './types';

export default function resolveLogicalModelFieldDescriptors(
  model: LogicalModelItem,
): LogicalModelFieldDescriptor[] {
  return model.fields.flatMap((field) =>
    'scalar' in field.type
      ? [
          {
            name: field.name,
            nullable: field.type.nullable ?? false,
            scalar: field.type.scalar,
          },
        ]
      : [],
  );
}
