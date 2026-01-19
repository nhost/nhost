import { normalizeColumns } from '@/features/orgs/projects/database/dataGrid/utils/normalizeColumns';
import { isEmptyValue } from '@/lib/utils';
import type {
  CreateLocalRelationshipArgs,
  ForeignKeyConstraintOn,
  QualifiedTable,
  SuggestRelationshipsResponseRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';

interface PrepareSuggestedRelationshipDTOParams {
  baseTable: QualifiedTable;
  relationshipName: string;
  source: string;
  suggestion: SuggestRelationshipsResponseRelationshipsItem;
}

export default function prepareSuggestedRelationshipDTO({
  baseTable,
  relationshipName,
  source,
  suggestion,
}: PrepareSuggestedRelationshipDTOParams): CreateLocalRelationshipArgs {
  let foreignKeyConstraintOn: ForeignKeyConstraintOn | undefined;
  if (suggestion.type === 'array') {
    const remoteTable = suggestion.to?.table;
    const remoteColumns = normalizeColumns(suggestion.to?.columns);

    foreignKeyConstraintOn =
      remoteTable && remoteColumns.length > 0
        ? { table: remoteTable, columns: remoteColumns }
        : suggestion.to?.constraint_name;
  } else if (suggestion.type === 'object') {
    foreignKeyConstraintOn = suggestion.from?.columns;
  }

  if (isEmptyValue(foreignKeyConstraintOn)) {
    throw new Error(
      'Unable to derive the foreign key information from this suggestion.',
    );
  }

  return {
    table: baseTable,
    name: relationshipName,
    source,
    using: {
      foreign_key_constraint_on: foreignKeyConstraintOn!,
    },
  };
}
