import ControlledSelect from '@/components/common/ControlledSelect';
import ColumnAutocomplete from '@/components/dataBrowser/ColumnAutocomplete';
import type { HasuraOperator } from '@/types/dataBrowser';
import Option from '@/ui/v2/Option';
import Text from '@/ui/v2/Text';
import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import RuleRemoveButton from './RuleRemoveButton';
import RuleValueInput from './RuleValueInput';

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
  { value: '_eq', helperText: 'is equal' },
  { value: '_neq', helperText: 'is not equal' },
  { value: '_in_hasura', label: '_in', helperText: 'is in (X-Hasura-)' },
  { value: '_in', helperText: 'is in (array)' },
  { value: '_nin_hasura', label: '_nin', helperText: 'is not in (X-Hasura-)' },
  { value: '_nin', helperText: 'is not in (array)' },
  { value: '_gt', helperText: 'is greater than' },
  { value: '_lt', helperText: 'is lower than' },
  { value: '_gte', helperText: 'is greater than or equal' },
  { value: '_lte', helperText: 'is lower than or equal' },
  { value: '_ceq', helperText: 'is equal to column' },
  { value: '_cne', helperText: 'is not equal to column' },
  { value: '_cgt', helperText: 'is greater than column' },
  { value: '_clt', helperText: 'is lower than column' },
  { value: '_cgte', helperText: 'is greater than or equal to column' },
  { value: '_clte', helperText: 'is lower than or equal to column' },
  { value: '_is_null', helperText: 'is null' },
];

const textSpecificOperators: typeof commonOperators = [
  { value: '_like', helperText: 'is like' },
  { value: '_nlike', helperText: 'is not like' },
  { value: '_ilike', helperText: 'is like (case-insensitive)' },
  { value: '_nilike', helperText: 'is not like (case-insensitive)' },
  { value: '_similar', helperText: 'is similar' },
  { value: '_nsimilar', helperText: 'is not similar' },
  { value: '_regex', helperText: 'matches regex' },
  { value: '_nregex', helperText: `doesn't match regex` },
  { value: '_iregex', helperText: 'matches case-insensitive regex' },
  { value: '_niregex', helperText: `doesn't match case-insensitive regex` },
];

function renderOption({
  value,
  label,
  helperText,
}: typeof commonOperators[number]) {
  return (
    <Option key={value} value={value} className="grid grid-flow-col gap-2">
      <Text component="span" className="inline-block w-16">
        {label || value}
      </Text>

      {helperText && (
        <Text component="span" className="!text-greyscaleGrey">
          {helperText}
        </Text>
      )}
    </Option>
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
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();
  const { control, setValue } = useFormContext();
  const rowName = `${name}.rules.${index}`;

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

  return (
    <div
      className={twMerge(
        'flex lg:flex-row flex-col items-stretch lg:max-h-10 flex-1 space-y-1 lg:space-y-0',
        className,
      )}
      {...props}
    >
      <ColumnAutocomplete
        {...autocompleteField}
        schema={schemaSlug as string}
        table={tableSlug as string}
        rootClassName="lg:flex-grow-0 lg:flex-shrink-0 lg:flex-[320px] h-10"
        slotProps={{ input: { className: 'bg-white lg:!rounded-r-none' } }}
        fullWidth
        onChange={(_event, { value, columnMetadata, disableReset }) => {
          setSelectedTablePath(
            `${columnMetadata.table_schema}.${columnMetadata.table_name}`,
          );
          setSelectedColumnType(columnMetadata?.udt_name);
          setValue(`${rowName}.column`, value, { shouldDirty: true });

          if (disableReset) {
            return;
          }

          setValue(`${rowName}.operator`, '_eq', { shouldDirty: true });
          setValue(`${rowName}.value`, '', { shouldDirty: true });
        }}
        onInitialized={({ value, columnMetadata }) => {
          setSelectedTablePath(
            `${columnMetadata.table_schema}.${columnMetadata.table_name}`,
          );
          setSelectedColumnType(columnMetadata?.udt_name);
          setValue(`${rowName}.column`, value, { shouldDirty: true });
        }}
      />

      <ControlledSelect
        name={`${rowName}.operator`}
        className="lg:flex-grow-0 lg:flex-shrink-0 lg:flex-[140px] h-10"
        slotProps={{ root: { className: 'bg-white lg:!rounded-none' } }}
        fullWidth
        onChange={(_event, value: HasuraOperator) => {
          if (!['_in', '_nin', '_in_hasura', '_nin_hasura'].includes(value)) {
            return;
          }

          if (value === '_in_hasura' || value === '_nin_hasura') {
            setValue(`${rowName}.value`, null, { shouldDirty: true });

            return;
          }

          setValue(`${rowName}.value`, [], { shouldDirty: true });
        }}
        renderValue={(option) => {
          if (!option?.value) {
            return <span />;
          }

          if (option.value === '_in_hasura') {
            return <span>_in</span>;
          }

          if (option.value === '_nin_hasura') {
            return <span>_nin</span>;
          }

          return <span>{option.value}</span>;
        }}
      >
        {availableOperators.map(renderOption)}
      </ControlledSelect>

      <RuleValueInput selectedTablePath={selectedTablePath} name={rowName} />

      <RuleRemoveButton onRemove={onRemove} name={name} />
    </div>
  );
}
