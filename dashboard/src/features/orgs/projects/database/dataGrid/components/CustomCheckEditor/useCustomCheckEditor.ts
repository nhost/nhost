import type { ComponentType } from 'react';
import { createContext, useContext } from 'react';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

export interface AddNodeRendererProps {
  onSelect: (node: RuleNode) => void;
  fullWidth?: boolean;
  label?: string;
}

export interface ConditionFieldSelection {
  fieldPath: string;
  fieldType: string;
}

export interface ConditionFieldRendererProps {
  name: string;
  onFieldSelectionChange: (selection: ConditionFieldSelection) => void;
}

export interface ConditionOperatorRendererProps {
  name: string;
  selectedFieldType?: string;
}

export interface ConditionValueRendererProps {
  name: string;
  selectedFieldPath: string;
  className?: string;
}

export interface NodeRendererProps {
  name: string;
  onRemove?: VoidFunction;
  depth?: number;
  maxDepth?: number;
}

export interface GroupOperatorRendererProps {
  name: string;
  depth?: number;
}

export interface CustomCheckEditorDialect {
  AddNode: ComponentType<AddNodeRendererProps>;
  ConditionField: ComponentType<ConditionFieldRendererProps>;
  ConditionOperator: ComponentType<ConditionOperatorRendererProps>;
  ConditionValue: ComponentType<ConditionValueRendererProps>;
  GroupOperator: ComponentType<GroupOperatorRendererProps>;
  ExistsNode: ComponentType<NodeRendererProps>;
  RelationshipNode: ComponentType<NodeRendererProps>;
  UnsupportedNode: ComponentType<NodeRendererProps>;
}

export interface CustomCheckEditorContextValue {
  schema: string;
  table: string;
  dialect: CustomCheckEditorDialect;
}

export const CustomCheckEditorContext =
  createContext<CustomCheckEditorContextValue | null>(null);

export default function useCustomCheckEditor(): CustomCheckEditorContextValue {
  const context = useContext(CustomCheckEditorContext);

  if (!context) {
    throw new Error(
      'useCustomCheckEditor must be used within a CustomCheckEditorContext provider.',
    );
  }

  return context;
}
