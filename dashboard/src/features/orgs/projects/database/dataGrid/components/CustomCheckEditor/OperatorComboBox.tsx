import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import { getAvailableOperators } from './getAvailableOperators';

interface OperatorComboBoxProps {
  name: string;
  selectedColumnType?: string;
}

export default function OperatorComboBox({
  name,
  selectedColumnType,
}: OperatorComboBoxProps) {
  const { setValue, clearErrors } = useFormContext();

  const operator = useWatch({ name: `${name}.operator` });

  const availableOperators = getAvailableOperators(selectedColumnType);

  const maxOperatorLength = useMemo(
    () => Math.max(...availableOperators.map((op) => op.value.length)),
    [availableOperators],
  );

  const handleSelect = (value: string) => {
    const newValue = ['_in', '_nin'].includes(value) ? [] : null;
    setValue(`${name}.value`, newValue, { shouldDirty: true });
    setValue(`${name}.operator`, value, { shouldDirty: true });
    clearErrors();
  };

  const options = useMemo(
    () =>
      availableOperators.map((op) => ({
        value: op.value,
        label: op.value,
        keywords: [op.helperText, op.value],
        render: (
          <div className="flex flex-row gap-2">
            <span
              className="shrink-0"
              style={{ minWidth: `${maxOperatorLength}ch` }}
            >
              {op.value}
            </span>
            <span className="text-muted-foreground">{op.helperText}</span>
          </div>
        ),
      })),
    [availableOperators, maxOperatorLength],
  );

  return (
    <Combobox
      options={options}
      value={operator || null}
      onChange={handleSelect}
      placeholder="Select operator..."
      searchPlaceholder="Search operator..."
      emptyText="No operator found."
      className="w-full xl:w-40"
      popoverContentClassName="w-80"
    />
  );
}
