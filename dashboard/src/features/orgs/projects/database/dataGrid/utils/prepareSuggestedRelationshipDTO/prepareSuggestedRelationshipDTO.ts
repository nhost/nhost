import { zipRelationshipColumnPairs } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { normalizeColumns } from '@/features/orgs/projects/database/dataGrid/utils/normalizeColumns';
import type {
  CreateLocalRelationshipArgs,
  ForeignKeyConstraintOn,
  QualifiedTable,
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

interface PrepareSuggestedRelationshipDTOParams {
  baseTable: QualifiedTable;
  relationshipName: string;
  source: string;
  suggestion: SuggestedArrayRelationship | SuggestedObjectRelationship;
}

function isValidTable(
  table: QualifiedTable | undefined,
): table is QualifiedTable {
  return !!table?.schema && !!table.name;
}

export default function prepareSuggestedRelationshipDTO({
  baseTable,
  relationshipName,
  source,
  suggestion,
}: PrepareSuggestedRelationshipDTOParams): CreateLocalRelationshipArgs {
  const fromTable = suggestion.from?.table;
  const toTable = suggestion.to?.table;
  const fromColumns = normalizeColumns(suggestion.from?.columns);
  const toColumns = normalizeColumns(suggestion.to?.columns);
  const columnPairs = zipRelationshipColumnPairs(fromColumns, toColumns);

  if (
    !isValidTable(baseTable) ||
    !isValidTable(fromTable) ||
    !isValidTable(toTable) ||
    relationshipName.length === 0 ||
    source.length === 0 ||
    !columnPairs ||
    (suggestion.type !== 'array' && suggestion.type !== 'object')
  ) {
    throw new Error(
      'Unable to derive the foreign key information from this suggestion.',
    );
  }

  const foreignKeyConstraintOn: ForeignKeyConstraintOn =
    suggestion.type === 'array'
      ? {
          table: toTable,
          columns: columnPairs.map(({ toColumn }) => toColumn),
        }
      : columnPairs.map(({ fromColumn }) => fromColumn);

  return {
    table: baseTable,
    name: relationshipName,
    source,
    using: { foreign_key_constraint_on: foreignKeyConstraintOn },
  };
}
