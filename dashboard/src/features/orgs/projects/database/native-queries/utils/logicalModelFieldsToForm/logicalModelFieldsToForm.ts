import type { LogicalModelFieldNode } from '@/features/orgs/projects/database/native-queries/types/logicalModelTypeNode';
import logicalModelTypeToForm from '@/features/orgs/projects/database/native-queries/utils/logicalModelTypeToForm';
import type { LogicalModelField } from '@/utils/hasura-api/generated/schemas';

export default function logicalModelFieldsToForm(
  fields: LogicalModelField[],
): LogicalModelFieldNode[] {
  return fields.map((field) => ({
    name: field.name,
    type: logicalModelTypeToForm(field.type),
    description: field.description ?? '',
  }));
}
