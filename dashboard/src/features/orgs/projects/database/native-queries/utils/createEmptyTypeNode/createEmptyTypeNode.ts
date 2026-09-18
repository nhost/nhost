import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/types/logicalModelTypeNode';

export default function createEmptyTypeNode(): LogicalModelTypeNode {
  return { kind: 'scalar', scalar: '', nullable: false };
}
