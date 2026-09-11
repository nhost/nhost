import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import AddNodeMenu from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/AddNodeMenu';
import type { AddNodeRendererProps } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import { useLogicalFields } from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalFieldsContext';

export default function LogicalAddNode({
  onSelect,
  fullWidth,
  label = 'Add check',
}: AddNodeRendererProps) {
  const [open, setOpen] = useState(false);
  const fields = useLogicalFields();
  const selectableFields = fields.descriptors.filter(
    (descriptor) => descriptor.selectable,
  );

  function addCondition(fieldPath: string) {
    onSelect({
      type: 'condition',
      id: uuidv4(),
      column: fieldPath,
      operator: '_eq',
      value: null,
    });
    setOpen(false);
  }

  function addGroup(operator: '_and' | '_or' | '_not') {
    onSelect({ type: 'group', id: uuidv4(), operator, children: [] });
    setOpen(false);
  }

  return (
    <AddNodeMenu
      open={open}
      onOpenChange={setOpen}
      disabled={selectableFields.length === 0}
      fullWidth={fullWidth}
      label={label}
      columns={selectableFields.map((field) => ({
        value: field.path,
        label: field.path,
        badge: field.scalar,
      }))}
      onSelectColumn={addCondition}
      onSelectGroup={addGroup}
    />
  );
}
