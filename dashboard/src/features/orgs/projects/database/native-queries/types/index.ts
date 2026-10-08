export type LogicalModelTypeNode =
  | { kind: 'scalar'; scalar: string; nullable: boolean }
  | { kind: 'logical_model'; logicalModel: string; nullable: boolean }
  | { kind: 'array'; item: LogicalModelTypeNode; nullable: boolean };

export interface LogicalModelFieldNode {
  name: string;
  type: LogicalModelTypeNode;
  description: string;
}

export type NativeQueryRelationshipKind = 'object' | 'array';

export interface NativeQueryRelationshipFieldMapping {
  sourceField: string;
  targetField: string;
}

export interface NativeQueryRelationshipInput {
  name: string;
  kind: NativeQueryRelationshipKind;
  remoteNativeQuery: string;
  fieldMappings: NativeQueryRelationshipFieldMapping[];
  insertionOrder: 'before_parent' | 'after_parent' | null;
}
