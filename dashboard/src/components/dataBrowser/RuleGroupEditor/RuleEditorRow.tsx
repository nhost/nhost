import ControlledSelect from '@/components/common/ControlledSelect';
import ColumnAutocomplete from '@/components/dataBrowser/ColumnAutocomplete';
import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import XIcon from '@/ui/v2/icons/XIcon';
import Option from '@/ui/v2/Option';
import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
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
}

function RemoveButton({
  name,
  onRemove,
}: Pick<RuleEditorRowProps, 'name' | 'onRemove'>) {
  const rules: Rule[] = useWatch({ name: `${name}.rules` });
  const groups: RuleGroup[] = useWatch({ name: `${name}.groups` });

  return (
    <Button
      variant="outlined"
      color="secondary"
      className="!bg-white lg:!rounded-l-none "
      disabled={rules.length === 1 && groups.length === 0}
      aria-label="Remove Rule"
      onClick={onRemove}
    >
      <XIcon />
    </Button>
  );
}

export default function RuleEditorRow({
  name,
  index,
  onRemove,
  className,
  ...props
}: RuleEditorRowProps) {
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();
  const { control, setValue } = useFormContext();
  const rowName = `${name}.rules.${index}`;

  const [selectedColumnType, setSelectedColumnType] = useState<string>('');
  const { field: autocompleteField } = useController({
    name: `${rowName}.column`,
    control,
  });

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
        rootClassName="flex-grow-1 lg:flex-shrink-0 lg:flex-[320px] h-10"
        slotProps={{
          input: { className: 'bg-white lg:!rounded-r-none' },
        }}
        fullWidth
        onChange={(_event, { value, type }) => {
          setSelectedColumnType(type);
          setValue(`${rowName}.column`, value, { shouldDirty: true });
          setValue(`${rowName}.operator`, '_eq', { shouldDirty: true });
          setValue(`${rowName}.value`, '', { shouldDirty: true });
        }}
      />

      <ControlledSelect
        name={`${rowName}.operator`}
        className="flex-grow-1 lg:flex-shrink-0 lg:flex-[140px] h-10"
        slotProps={{ root: { className: 'bg-white lg:!rounded-none' } }}
        fullWidth
      >
        <Option value="_eq">_eq</Option>
        <Option value="_ne">_ne</Option>
        <Option value="_in">_in</Option>
        <Option value="_nin">_nin</Option>
        <Option value="_gt">_gt</Option>
        <Option value="_lt">_lt</Option>
        <Option value="_gte">_gte</Option>
        <Option value="_lte">_lte</Option>
        <Option value="_ceq">_ceq</Option>
        <Option value="_cne">_cne</Option>
        <Option value="_cgt">_cgt</Option>
        <Option value="_clt">_clt</Option>
        <Option value="_cgte">_cgte</Option>
        <Option value="_clte">_clte</Option>
        <Option value="_is_null">_is_null</Option>

        {selectedColumnType === 'text' && (
          <>
            <Option value="_like">_like</Option>
            <Option value="_nlike">_nlike</Option>
            <Option value="_ilike">_ilike</Option>
            <Option value="_nilike">_nilike</Option>
            <Option value="_similar">_similar</Option>
            <Option value="_nsimilar">_nsimilar</Option>
            <Option value="_regex">_regex</Option>
            <Option value="_iregex">_iregex</Option>
            <Option value="_nregex">_nregex</Option>
            <Option value="_niregex">_niregex</Option>
          </>
        )}
      </ControlledSelect>

      <RuleValueInput name={rowName} />

      <RemoveButton onRemove={onRemove} name={name} />
    </div>
  );
}
