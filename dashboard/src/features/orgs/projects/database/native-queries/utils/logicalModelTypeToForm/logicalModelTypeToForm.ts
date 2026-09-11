import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/types/logicalModelTypeNode';
import type { LogicalModelType } from '@/utils/hasura-api/generated/schemas';

export default function logicalModelTypeToForm(
  type: LogicalModelType,
): LogicalModelTypeNode {
  if ('scalar' in type) {
    return {
      kind: 'scalar',
      scalar: type.scalar,
      nullable: type.nullable ?? false,
    };
  }

  if ('logical_model' in type) {
    return {
      kind: 'logical_model',
      logicalModel: type.logical_model,
      nullable: type.nullable ?? false,
    };
  }

  return {
    kind: 'array',
    item: logicalModelTypeToForm(type.array),
    nullable: type.nullable ?? false,
  };
}
