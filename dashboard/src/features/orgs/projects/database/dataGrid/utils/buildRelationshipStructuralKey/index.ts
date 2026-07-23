export type {
  LocalRelationshipIdentityInput,
  RelationshipColumnPair,
  RelationshipIdentityEndpoint,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey/buildRelationshipStructuralKey';
export {
  alignRelationshipColumnPairsByFromColumns,
  alignRelationshipColumnPairsByToColumns,
  default as buildRelationshipStructuralKey,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey/buildRelationshipStructuralKey';
