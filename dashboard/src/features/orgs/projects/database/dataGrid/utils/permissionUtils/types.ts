import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
export type LogicalOperator = '_and' | '_or' | '_not' | '_implicit';

export interface ConditionNode {
  type: 'condition';
  id: string;
  column: string;
  operator: HasuraOperator;
  value: unknown;
}

export interface GroupNode {
  type: 'group';
  id: string;
  operator: LogicalOperator;
  children: RuleNode[];
}

export interface ExistsNode {
  type: 'exists';
  id: string;
  schema: string;
  table: string;
  where: GroupNode;
}

export interface RelationshipNode {
  type: 'relationship';
  id: string;
  relationship: string;
  child: GroupNode;
}

export type RuleNode =
  | ConditionNode
  | GroupNode
  | ExistsNode
  | RelationshipNode;

export function isConditionNode(node: RuleNode): node is ConditionNode {
  return node.type === 'condition';
}

export function isGroupNode(node: RuleNode): node is GroupNode {
  return node.type === 'group';
}

export function isExistsNode(node: RuleNode): node is ExistsNode {
  return node.type === 'exists';
}

export function isRelationshipNode(node: RuleNode): node is RelationshipNode {
  return node.type === 'relationship';
}
