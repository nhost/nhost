import HighlightedText from '@/components/common/HighlightedText';
import RuleGroupEditor from '@/components/dataBrowser/RuleGroupEditor';
import type { DatabaseAction, RuleGroup } from '@/types/dataBrowser';
import Input from '@/ui/v2/Input';
import Radio from '@/ui/v2/Radio';
import RadioGroup from '@/ui/v2/RadioGroup';
import Text from '@/ui/v2/Text';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { RolePermissionEditorFormValues } from './RolePermissionEditorForm';

export interface RowPermissionsSectionProps {
  /**
   * The role that is being edited.
   */
  role: string;
  /**
   * The action that is being edited.
   */
  action: DatabaseAction;
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
}

export default function RowPermissionsSection({
  role,
  action,
  schema,
  table,
}: RowPermissionsSectionProps) {
  const { register, setValue, getValues } =
    useFormContext<RolePermissionEditorFormValues>();
  const { filter } = getValues();
  const defaultRowCheckType =
    filter && Object.keys(filter).length === 0 ? 'none' : 'custom';

  const [temporaryPermissions, setTemporaryPermissions] =
    useState<RuleGroup>(null);
  const [rowCheckType, setRowCheckType] = useState<'none' | 'custom'>(
    () => defaultRowCheckType,
  );

  function handleCheckTypeChange(value: typeof rowCheckType) {
    setRowCheckType(value);

    if (value === 'none') {
      setTemporaryPermissions(getValues().filter);

      // Note: https://github.com/react-hook-form/react-hook-form/issues/4055#issuecomment-950145092
      // @ts-ignore
      setValue('filter', {});

      return;
    }

    setRowCheckType(value);
    setValue(
      'filter',
      temporaryPermissions || {
        operator: '_and',
        rules: [{ column: '', operator: '_eq', value: '' }],
        groups: [],
      },
    );
  }

  return (
    <section className="bg-white border-y-1 border-gray-200">
      <Text
        component="h2"
        className="px-6 py-3 font-bold border-b-1 border-gray-200"
      >
        Row {action} permissions
      </Text>

      <div className="grid grid-flow-row gap-4 items-center px-6 py-4">
        <Text>
          Allow role <HighlightedText>{role}</HighlightedText> to{' '}
          <HighlightedText>{action}</HighlightedText> rows:
        </Text>

        <RadioGroup
          value={rowCheckType}
          className="grid grid-flow-col justify-start gap-4"
          onChange={(_event, value) =>
            handleCheckTypeChange(value as typeof rowCheckType)
          }
        >
          <Radio value="none" label="Without any checks" />
          <Radio value="custom" label="With custom check" />
        </RadioGroup>

        {rowCheckType === 'custom' && (
          <RuleGroupEditor name="filter" schema={schema} table={table} />
        )}

        {action === 'select' && (
          <Input
            {...register('limit')}
            id="limit"
            type="number"
            label="Limit number of rows"
            slotProps={{
              input: { className: 'max-w-xs w-full' },
              inputRoot: { min: 0 },
            }}
            helperText="Set limit on number of rows fetched per request."
          />
        )}
      </div>
    </section>
  );
}
