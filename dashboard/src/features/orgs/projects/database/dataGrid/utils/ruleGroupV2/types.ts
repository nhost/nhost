import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export type LogicalOperator = '_and' | '_or' | '_not';

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

// TODO: understand these types what is a condition and what is a group
export type RuleNode = ConditionNode | GroupNode | ExistsNode;

export function isConditionNode(node: RuleNode): node is ConditionNode {
  return node.type === 'condition';
}

export function isGroupNode(node: RuleNode): node is GroupNode {
  return node.type === 'group';
}

export function isExistsNode(node: RuleNode): node is ExistsNode {
  return node.type === 'exists';
}
