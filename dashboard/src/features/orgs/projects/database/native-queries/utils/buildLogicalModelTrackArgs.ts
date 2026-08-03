import type { LogicalModelFieldNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { formFieldsToLogicalModelFields } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import type { TrackLogicalModelArgs } from '@/utils/hasura-api/generated/schemas';

export interface LogicalModelFormValues {
  source: string;
  name: string;
  description: string;
  fields: LogicalModelFieldNode[];
}

export default function buildLogicalModelTrackArgs(
  values: LogicalModelFormValues,
): TrackLogicalModelArgs {
  const description = values.description.trim();

  return {
    source: values.source,
    name: values.name.trim(),
    fields: formFieldsToLogicalModelFields(values.fields),
    ...(description ? { description } : {}),
  };
}
