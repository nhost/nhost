import type { CustomCheckEditorDialect } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import LogicalAddNode from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalAddNode';
import LogicalConditionField from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalConditionField';
import LogicalConditionOperator from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalConditionOperator';
import LogicalConditionValue from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalConditionValue';
import LogicalGroupOperator from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalGroupOperator';
import UnsupportedLogicalNode from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/UnsupportedLogicalNode';

const logicalModelCustomCheckEditorDialect: CustomCheckEditorDialect = {
  AddNode: LogicalAddNode,
  ConditionField: LogicalConditionField,
  ConditionOperator: LogicalConditionOperator,
  ConditionValue: LogicalConditionValue,
  GroupOperator: LogicalGroupOperator,
  ExistsNode: UnsupportedLogicalNode,
  RelationshipNode: UnsupportedLogicalNode,
  UnsupportedNode: UnsupportedLogicalNode,
};

export default logicalModelCustomCheckEditorDialect;
