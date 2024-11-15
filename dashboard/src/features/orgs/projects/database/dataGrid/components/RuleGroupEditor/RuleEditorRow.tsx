import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { ColumnAutocomplete } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
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
  /**
   * List of operators to be disabled for the rule editor.
   *
   * @default []
   */
  disabledOperators?: HasuraOperator[];
}

const commonOperators: {
  value: HasuraOperator;
  label?: string;
  helperText?: string;
}[] = [
  { value: '_eq', helperText: 'equal' },
  { value: '_neq', helperText: 'not equal' },
  { value: '_in', helperText: 'in (array)' },
  { value: '_nin', helperText: 'not in (array)' },
  { value: '_gt', helperText: 'greater than' },
  { value: '_lt', helperText: 'lower than' },
  { value: '_gte', helperText: 'greater than or equal' },
  { value: '_lte', helperText: 'lower than or equal' },
  { value: '_ceq', helperText: 'equal to column' },
  { value: '_cne', helperText: 'not equal to column' },
  { value: '_cgt', helperText: 'greater than column' },
  { value: '_clt', helperText: 'lower than column' },
  { value: '_cgte', helperText: 'greater than or equal to column' },
  { value: '_clte', helperText: 'lower than or equal to column' },
  { value: '_is_null', helperText: 'null' },
];

const textSpecificOperators: typeof commonOperators = [
  { value: '_like', helperText: 'like' },
  { value: '_nlike', helperText: 'not like' },
  { value: '_ilike', helperText: 'like (case-insensitive)' },
  { value: '_nilike', helperText: 'not like (case-insensitive)' },
  { value: '_similar', helperText: 'similar' },
  { value: '_nsimilar', helperText: 'not similar' },
  { value: '_regex', helperText: 'matches regex' },
  { value: '_nregex', helperText: `doesn't match regex` },
  { value: '_iregex', helperText: 'matches case-insensitive regex' },
  { value: '_niregex', helperText: `doesn't match case-insensitive regex` },
];

function renderOption({
  value,
  label,
  helperText,
}: (typeof commonOperators)[number]) {
  return (
    <SelectItem key={value} value={value} className="grid grid-flow-col gap-2">
      <span className="inline-block w-16">{label || value}</span>

      {helperText && (
        <span className="text-muted-foreground">{helperText}</span>
      )}
    </SelectItem>
  );
}

export default function RuleEditorRow({
  name,
  index,
  onRemove,
  className,
  disabledOperators = [],
  ...props
}: RuleEditorRowProps) {
  const { schema, table, disabled } = useRuleGroupEditor();
  const { control, setValue, getFieldState, watch } = useFormContext();
  const rowName = `${name}.rules.${index}`;

  const columnState = getFieldState(`${rowName}.column`);
  const operatorState = getFieldState(`${rowName}.operator`);
  const valueState = getFieldState(`${rowName}.value`);

  const operator = watch(`${rowName}.operator`);

  const [selectedTablePath, setSelectedTablePath] = useState<string>('');
  const [selectedColumnType, setSelectedColumnType] = useState<string>('');
  const { field: autocompleteField } = useController({
    name: `${rowName}.column`,
    control,
  });

  const disabledOperatorMap = disabledOperators.reduce(
    (map, currentOperator) => map.set(currentOperator, true),
    new Map<string, boolean>(),
  );

  const availableOperators = [
    ...commonOperators.filter(({ value }) => !disabledOperatorMap.has(value)),
    ...(selectedColumnType === 'text'
      ? textSpecificOperators.filter(
          ({ value }) => !disabledOperatorMap.get(value),
        )
      : []),
  ];

  const handleSelect = (value: string) => {
    if (['_in', '_nin'].includes(value)) {
      setValue(`${rowName}.value`, [], { shouldDirty: true });
    }

    setValue(`${rowName}.operator`, value, { shouldDirty: true });
  };

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
        disabled={disabled}
        schema={schema}
        table={table}
        // rootClassName="h-10"
        slotProps={{
          input: {
            className: 'lg:!rounded-r-none',
            sx: !disabled
              ? {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark' ? 'grey.300' : 'common.white',
                }
              : undefined,
          },
        }}
        fullWidth
        error={Boolean(columnState?.error?.message)}
        onChange={(_event, { value, columnMetadata, disableReset }) => {
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
      <Select
        disabled={disabled}
        onValueChange={handleSelect}
        defaultValue={operator}
        value={operator}
      >
        <SelectTrigger className="z-20 h-10 rounded-l-none rounded-r-none [&>*>*:nth-child(2)]:hidden [&>*>*]:block [&>*>*]:w-auto">
          <SelectValue placeholder="Select a verified email to display" />
        </SelectTrigger>
        <SelectContent>{availableOperators.map(renderOption)}</SelectContent>
      </Select>
      <RuleValueInput
        selectedTablePath={selectedTablePath}
        name={rowName}
        className="min-h-10 rounded-l-none rounded-r-none"
        error={Boolean(valueState?.error?.message)}
      />

      <RuleRemoveButton onRemove={onRemove} name={name} disabled={disabled} />
    </div>
  );
}
