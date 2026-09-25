import { useController, useFormContext } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import useLogicalModelCustomCheckEditor from './useLogicalModelCustomCheckEditor';

interface LogicalModelComparisonFieldPickerProps {
  name: string;
  className?: string;
}

export default function LogicalModelComparisonFieldPicker({
  name,
  className,
}: LogicalModelComparisonFieldPickerProps) {
  const { control, setValue, clearErrors } = useFormContext();
  const { fields } = useLogicalModelCustomCheckEditor();
  const { field, fieldState } = useController({ name, control });
  const options = fields.map((descriptor) => ({
    value: descriptor.name,
    label: descriptor.name,
    keywords: [descriptor.scalar],
  }));

  return (
    <Combobox
      value={
        // this array can either be ['$', 'fieldName'] or ['fieldName']
        (Array.isArray(field.value) ? field.value.slice(-1)[0] : field.value) ??
        null
      }
      onChange={(path) => {
        setValue(name, ['$', path], {
          shouldDirty: true,
        });
        clearErrors(name);
      }}
      onBlur={field.onBlur}
      options={options}
      placeholder="Select referenced field..."
      searchPlaceholder="Search logical model fields..."
      emptyText="No scalar fields found."
      className={className}
      aria-label="Logical model comparison field"
      aria-invalid={fieldState.invalid}
    />
  );
}
