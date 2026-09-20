export type LogicalModelTypeNode =
  | { kind: 'scalar'; scalar: string; nullable: boolean }
  | { kind: 'logical_model'; logicalModel: string; nullable: boolean }
  | { kind: 'array'; item: LogicalModelTypeNode; nullable: boolean };

export interface LogicalModelFieldNode {
  name: string;
  type: LogicalModelTypeNode;
  description: string;
}
