import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Input } from '@/components/ui/v2/Input';
import { Radio } from '@/components/ui/v2/Radio';
import { RadioGroup } from '@/components/ui/v2/RadioGroup';
import { Text } from '@/components/ui/v2/Text';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { RuleGroupEditor } from '@/features/orgs/projects/database/dataGrid/components/RuleGroupEditor';
import type {
  DatabaseAction,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { FocusEvent } from 'react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface RowPermissionsSectionProps {
  /**
   * Determines whether or not the section is disabled.
   */
  disabled?: boolean;
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
  disabled,
}: RowPermissionsSectionProps) {
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<RolePermissionEditorFormValues>();
  const { filter } = getValues();

  const defaultRowCheckType =
    filter &&
    'rules' in filter &&
    'groups' in filter &&
    (filter.rules.length > 0 ||
      filter.groups.length > 0 ||
      filter.unsupported?.length > 0)
      ? 'custom'
      : 'none';

  const [temporaryPermissions, setTemporaryPermissions] = useState<
    RuleGroup | {}
  >(null);

  const [rowCheckType, setRowCheckType] = useState<'none' | 'custom'>(
    filter ? defaultRowCheckType : null,
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
    <PermissionSettingsSection title={`Row ${action} permissions`}>
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
        <Radio value="none" label="Without any checks" disabled={disabled} />
        <Radio value="custom" label="With custom check" disabled={disabled} />
      </RadioGroup>

      {errors?.filter?.message && (
        <Text
          variant="subtitle2"
          className="font-normal"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          {errors.filter.message}
        </Text>
      )}

      {rowCheckType === 'custom' && (
        <RuleGroupEditor
          name="filter"
          schema={schema}
          table={table}
          className="w-full overflow-x-auto"
          disabled={disabled}
        />
      )}

      {action === 'select' && (
        <Input
          {...register('limit', {
            onBlur: (event: FocusEvent<HTMLInputElement>) => {
              if (!event.target.value) {
                setValue('limit', null);
              }
            },
          })}
          disabled={disabled}
          id="limit"
          type="number"
          label="Limit number of rows"
          slotProps={{
            input: { className: 'max-w-xs w-full' },
            inputRoot: { min: 0 },
          }}
          helperText={
            errors?.limit?.message ||
            'Set limit on number of rows fetched per request.'
          }
          error={Boolean(errors?.limit)}
        />
      )}
    </PermissionSettingsSection>
  );
}
