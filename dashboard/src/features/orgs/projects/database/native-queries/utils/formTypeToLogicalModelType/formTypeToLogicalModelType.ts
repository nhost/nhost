import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/types';
import type { LogicalModelType } from '@/utils/hasura-api/generated/schemas';

export default function formTypeToLogicalModelType(
  type: LogicalModelTypeNode,
): LogicalModelType {
  if (type.kind === 'scalar') {
    return { scalar: type.scalar, nullable: type.nullable };
  }

  if (type.kind === 'logical_model') {
    return { logical_model: type.logicalModel, nullable: type.nullable };
  }

  return {
    array: formTypeToLogicalModelType(type.item),
    nullable: type.nullable,
  };
}
