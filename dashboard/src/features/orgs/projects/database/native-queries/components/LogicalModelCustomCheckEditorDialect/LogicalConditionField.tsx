import { useController, useFormContext } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { ConditionFieldRendererProps } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import { useLogicalFields } from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/LogicalFieldsContext';

export default function LogicalConditionField({
  name,
  onFieldSelectionChange,
}: ConditionFieldRendererProps) {
  const fields = useLogicalFields();
  const { control, setValue, clearErrors } = useFormContext();
  const { field } = useController({ name: `${name}.column`, control });

  return (
    <Select
      value={field.value ?? ''}
      onValueChange={(fieldPath) => {
        const descriptor = fields.descriptors.find(
          (item) => item.selectable && item.path === fieldPath,
        );
        setValue(`${name}.column`, fieldPath, { shouldDirty: true });
        setValue(`${name}.operator`, '_eq', { shouldDirty: true });
        setValue(`${name}.value`, null, { shouldDirty: true });
        clearErrors();
        onFieldSelectionChange({
          fieldPath,
          fieldType: descriptor?.scalar ?? '',
        });
      }}
    >
      <SelectTrigger aria-label="Logical model field">
        <SelectValue placeholder="Select field..." />
      </SelectTrigger>
      <SelectContent>
        {fields.selectablePaths.map((fieldPath) => (
          <SelectItem key={fieldPath} value={fieldPath}>
            {fieldPath}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
