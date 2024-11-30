import { ColumnAutocomplete } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import OperatorComboBox from './OperatorComboBox';
import RuleRemoveButton from './RuleRemoveButton';
import RuleValueInput from './RuleValueInput';
import useRuleGroupEditor from './useRuleGroupEditor';

export interface RuleEditorRowProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Name of the parent group editor.
   */
  name: string;
  /**
   * Index of the rule.
   */
  index: number;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

export default function RuleEditorRow({
  name,
  index,
  onRemove,
  className,
  ...props
}: RuleEditorRowProps) {
  const { schema, table } = useRuleGroupEditor();
  const { control, setValue, getFieldState } = useFormContext();
  const rowName = `${name}.rules.${index}`;

  const valueState = getFieldState(`${rowName}.value`);

  const [selectedTablePath, setSelectedTablePath] = useState<string>('');
  const [selectedColumnType, setSelectedColumnType] = useState<string>('');
  const { field: autocompleteField } = useController({
    name: `${rowName}.column`,
    control,
  });

  return (
    <div
      className={twMerge(
        'grid grid-flow-row space-y-1 lg:grid-cols-[320px_140px_minmax(100px,_1fr)_40px] lg:space-y-0',
        className,
      )}
      {...props}
    >
      <ColumnAutocomplete
        {...autocompleteField}
        schema={schema}
        table={table}
        onChange={({ value, columnMetadata, disableReset }) => {
          setSelectedTablePath(
            `${columnMetadata.table_schema}.${columnMetadata.table_name}`,
          );
          setSelectedColumnType(columnMetadata?.udt_name);
          setValue(`${rowName}.column`, value, {
            shouldDirty: true,
          });

          if (disableReset) {
            return;
          }

          setValue(`${rowName}.operator`, '_eq', {
            shouldDirty: true,
          });
          setValue(`${rowName}.value`, '', { shouldDirty: true });
        }}
        onInitialized={({ value, columnMetadata }) => {
          setSelectedTablePath(
            `${columnMetadata.table_schema}.${columnMetadata.table_name}`,
          );
          setSelectedColumnType(columnMetadata?.udt_name);
          setValue(`${rowName}.column`, value, {
            shouldDirty: true,
          });
        }}
      />
      <OperatorComboBox
        name={rowName}
        selectedColumnType={selectedColumnType}
      />
      <RuleValueInput
        selectedTablePath={selectedTablePath}
        name={rowName}
        className="min-h-10 rounded-l-none rounded-r-none"
        error={Boolean(valueState?.error?.message)}
      />

      <RuleRemoveButton onRemove={onRemove} name={name} />
    </div>
  );
}
