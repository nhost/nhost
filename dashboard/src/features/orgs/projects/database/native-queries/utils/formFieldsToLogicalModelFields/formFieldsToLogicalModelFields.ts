import type { LogicalModelFieldNode } from '@/features/orgs/projects/database/native-queries/types';
import { formTypeToLogicalModelType } from '@/features/orgs/projects/database/native-queries/utils/formTypeToLogicalModelType';
import type { LogicalModelField } from '@/utils/hasura-api/generated/schemas';

export default function formFieldsToLogicalModelFields(
  fields: LogicalModelFieldNode[],
): LogicalModelField[] {
  return fields.map((field) => {
    const description = field.description.trim();

    return {
      name: field.name,
      type: formTypeToLogicalModelType(field.type),
      ...(description ? { description } : {}),
    };
  });
}
