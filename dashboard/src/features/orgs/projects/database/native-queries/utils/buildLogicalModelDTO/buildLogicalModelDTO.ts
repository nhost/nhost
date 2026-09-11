import type { LogicalModelFieldNode } from '@/features/orgs/projects/database/native-queries/types/logicalModelTypeNode';
import formFieldsToLogicalModelFields from '@/features/orgs/projects/database/native-queries/utils/formFieldsToLogicalModelFields';
import type { TrackLogicalModelArgs } from '@/utils/hasura-api/generated/schemas';

export interface LogicalModelFormValues {
  source: string;
  name: string;
  description: string;
  fields: LogicalModelFieldNode[];
}

export interface LogicalModelDTO {
  source: string;
  args: Omit<TrackLogicalModelArgs, 'source'>;
}

export default function buildLogicalModelDTO(
  values: LogicalModelFormValues,
): LogicalModelDTO {
  const description = values.description.trim();

  return {
    source: values.source,
    args: {
      name: values.name,
      fields: formFieldsToLogicalModelFields(values.fields),
      ...(description ? { description } : {}),
    },
  };
}
