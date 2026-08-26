export type {
  ArrayRelationshipRemoteIdentityInput,
  ForeignKeyColumnPairMatch,
  LocalRelationshipIdentityInput,
  RelationshipColumnPair,
} from './buildRelationshipStructuralKey';
export {
  alignRelationshipColumnPairs,
  buildArrayRelationshipRemoteKey,
  canonicalizeColumnPairs,
  default as buildRelationshipStructuralKey,
  matchForeignKeysToLocalColumns,
  zipRelationshipColumnPairs,
} from './buildRelationshipStructuralKey';
