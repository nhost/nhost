import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import ControlledSelect from '@/components/common/ControlledSelect';
import ReadOnlyToggle from '@/components/common/ReadOnlyToggle';
import type { PermissionOperator } from '@/types/dataBrowser';
import Option from '@/ui/v2/Option';
import { useFormContext, useWatch } from 'react-hook-form';

export interface RuleValueInputProps {
  /**
   * Name of the parent group editor.
   */
  name: string;
}

export default function RuleValueInput({ name }: RuleValueInputProps) {
  const { setValue } = useFormContext();
  const inputName = `${name}.value`;
  const operator: PermissionOperator = useWatch({ name: `${name}.operator` });

  if (operator === '_in' || operator === '_nin') {
    return (
      <ControlledAutocomplete
        name={inputName}
        multiple
        freeSolo
        className="flex-auto !bg-white"
        slotProps={{ input: { className: 'lg:!rounded-none' } }}
        limitTags={4}
        options={[
          { value: 'X-Hasura-Allowed-Ids', label: 'X-Hasura-Allowed-Ids' },
        ]}
        fullWidth
        filterSelectedOptions
        onChange={(_event, _value, reason, details) => {
          if (
            reason !== 'selectOption' ||
            details.option.value !== 'X-Hasura-Allowed-Ids'
          ) {
            return;
          }

          setValue(inputName, [details.option.value], { shouldDirty: true });
        }}
      />
    );
  }

  if (operator === '_is_null') {
    return (
      <ControlledSelect
        name={inputName}
        className="flex-auto"
        fullWidth
        slotProps={{ root: { className: 'bg-white lg:!rounded-none h-10' } }}
      >
        <Option value="true">
          <ReadOnlyToggle
            checked
            slotProps={{ label: { className: '!text-sm' } }}
          />
        </Option>

        <Option value="false">
          <ReadOnlyToggle
            checked={false}
            slotProps={{ label: { className: '!text-sm' } }}
          />
        </Option>
      </ControlledSelect>
    );
  }

  return (
    <ControlledAutocomplete
      freeSolo
      name={inputName}
      className="flex-auto !bg-white"
      slotProps={{ input: { className: 'lg:!rounded-none' } }}
      fullWidth
      options={[{ value: 'X-Hasura-User-Id', label: 'X-Hasura-User-Id' }]}
      onChange={(_event, value, reason, details) => {
        if (
          reason !== 'selectOption' &&
          details.option.value !== 'X-Hasura-User-Id'
        ) {
          return;
        }

        setValue(inputName, details.option.value, { shouldDirty: true });
      }}
    />
  );
}
