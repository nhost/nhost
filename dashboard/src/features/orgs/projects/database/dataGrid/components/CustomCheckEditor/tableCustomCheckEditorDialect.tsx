import AddNodeButton from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/AddNodeButton';
import ConditionField from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ConditionField';
import ConditionValue from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ConditionValue';
import ExistsNodeRenderer from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ExistsNodeRenderer';
import InvalidNodeRenderer from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/InvalidNodeRenderer';
import LogicalOperatorBadge from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/LogicalOperatorBadge';
import OperatorComboBox from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/OperatorComboBox';
import RelationshipNodeRenderer from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/RelationshipNodeRenderer';
import type {
  ConditionOperatorRendererProps,
  ConditionValueRendererProps,
  CustomCheckEditorDialect,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';

function TableConditionOperator({
  name,
  selectedFieldType,
}: ConditionOperatorRendererProps) {
  return (
    <OperatorComboBox name={name} selectedColumnType={selectedFieldType} />
  );
}

function TableConditionValue({
  selectedFieldPath,
  ...props
}: ConditionValueRendererProps) {
  return <ConditionValue {...props} selectedTablePath={selectedFieldPath} />;
}

const tableCustomCheckEditorDialect: CustomCheckEditorDialect = {
  AddNode: AddNodeButton,
  ConditionField,
  ConditionOperator: TableConditionOperator,
  ConditionValue: TableConditionValue,
  GroupOperator: LogicalOperatorBadge,
  ExistsNode: ExistsNodeRenderer,
  RelationshipNode: RelationshipNodeRenderer,
  UnsupportedNode: InvalidNodeRenderer,
};

export default tableCustomCheckEditorDialect;
