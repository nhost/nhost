import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import ControlledSelect from '@/components/common/ControlledSelect';
import ReadOnlyToggle from '@/components/common/ReadOnlyToggle';
import type { ColumnAutocompleteProps } from '@/components/dataBrowser/ColumnAutocomplete';
import ColumnAutocomplete from '@/components/dataBrowser/ColumnAutocomplete';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { HasuraOperator } from '@/types/dataBrowser';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import type { InputProps } from '@/ui/v2/Input';
import { inputClasses } from '@/ui/v2/Input';
import Option from '@/ui/v2/Option';
import getPermissionVariablesArray from '@/utils/settings/getPermissionVariablesArray';
import { useGetAppCustomClaimsQuery } from '@/utils/__generated__/graphql';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import useRuleGroupEditor from './useRuleGroupEditor';

function ColumnSelectorInput({
  name,
  selectedTablePath,
  schema,
  table,
  disabled,
  ...props
}: ColumnAutocompleteProps & { selectedTablePath: string }) {
  const { setValue, control } = useFormContext();
  const { field } = useController({
    name,
    control,
  });

  return (
    <ColumnAutocomplete
      {...props}
      {...field}
      disabled={disabled}
      value={
        // this array can either be ['$', 'columnName'] or ['columnName']
        Array.isArray(field.value) ? field.value.slice(-1)[0] : field.value
      }
      schema={schema}
      table={table}
      disableRelationships
      slotProps={{
        input: {
          className: 'lg:!rounded-none !z-10',
          sx: !disabled
            ? {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? theme.palette.grey[300]
                    : theme.palette.common.white,
                [`& .${inputClasses.input}`]: {
                  backgroundColor: 'transparent',
                },
              }
            : undefined,
        },
      }}
      onChange={(_event, { value }) => {
        if (selectedTablePath === `${schema}.${table}`) {
          setValue(name, [value], { shouldDirty: true });
          return;
        }

        // For more information, see https://github.com/hasura/graphql-engine/issues/3459#issuecomment-1085666541
        setValue(name, ['$', value], { shouldDirty: true });
      }}
    />
  );
}

export interface RuleValueInputProps {
  /**
   * Name of the parent group editor.
   */
  name: string;
  /**
   * Path of the table selected through the column input.
   */
  selectedTablePath?: string;
  /**
   * Whether the input should be marked as invalid.
   */
  error?: InputProps['error'];
  /**
   * Helper text to display below the input.
   */
  helperText?: InputProps['helperText'];
}

export default function RuleValueInput({
  name,
  selectedTablePath,
  error,
  helperText,
}: RuleValueInputProps) {
  const { schema, table, disabled } = useRuleGroupEditor();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { setValue } = useFormContext();
  const inputName = `${name}.value`;
  const operator: HasuraOperator = useWatch({ name: `${name}.operator` });
  const isHasuraInput = operator === '_in_hasura' || operator === '_nin_hasura';
  const sharedInputSx: InputProps['sx'] = !disabled
    ? {
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark'
            ? theme.palette.grey[300]
            : theme.palette.common.white,
        [`& .${inputClasses.input}`]: {
          backgroundColor: 'transparent',
        },
      }
    : undefined;

  const {
    data,
    loading,
    error: customClaimsError,
  } = useGetAppCustomClaimsQuery({
    variables: { id: currentApplication?.id },
    skip: !isHasuraInput || !currentApplication?.id,
  });

  if (operator === '_is_null') {
    return (
      <ControlledSelect
        disabled={disabled}
        name={inputName}
        fullWidth
        slotProps={{
          root: {
            className: 'lg:!rounded-none h-10',
            sx: !disabled
              ? {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? `${theme.palette.grey[300]} !important`
                      : `${theme.palette.common.white} !important`,
                }
              : null,
          },
          popper: { disablePortal: false, className: 'z-[10000]' },
        }}
        error={error}
        helperText={helperText}
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

  if (operator === '_in' || operator === '_nin') {
    return (
      <ControlledAutocomplete
        disabled={disabled}
        name={inputName}
        multiple
        freeSolo
        limitTags={3}
        slotProps={{
          input: {
            className: 'lg:!rounded-none !z-10',
            sx: sharedInputSx,
          },
          paper: { className: 'hidden' },
        }}
        options={[]}
        fullWidth
        filterSelectedOptions
        error={error}
        helperText={helperText}
      />
    );
  }

  if (['_ceq', '_cne', '_cgt', '_clt', '_cgte', '_clte'].includes(operator)) {
    return (
      <ColumnSelectorInput
        disabled={disabled}
        selectedTablePath={selectedTablePath}
        schema={schema}
        table={table}
        name={inputName}
        error={error}
        helperText={helperText}
      />
    );
  }

  const availableHasuraPermissionVariables = getPermissionVariablesArray(
    data?.app?.authJwtCustomClaims,
  ).map(({ key }) => ({
    value: `X-Hasura-${key}`,
    label: `X-Hasura-${key}`,
    group: 'Frequently used',
  }));

  return (
    <ControlledAutocomplete
      disabled={disabled}
      freeSolo={!isHasuraInput}
      autoSelect={!isHasuraInput}
      autoHighlight={isHasuraInput}
      open
      isOptionEqualToValue={(option, value) => {
        if (typeof value === 'string') {
          return option.value.toLowerCase() === (value as string).toLowerCase();
        }

        return option.value.toLowerCase() === value.value.toLowerCase();
      }}
      name={inputName}
      groupBy={(option) => option.group}
      slotProps={{
        input: {
          className: 'lg:!rounded-none',
          sx: sharedInputSx,
        },
        formControl: { className: '!bg-transparent' },
        paper: { className: 'empty:border-transparent' },
      }}
      fullWidth
      loading={loading}
      loadingText={<ActivityIndicator label="Loading..." />}
      error={Boolean(customClaimsError) || error}
      helperText={customClaimsError?.message || helperText}
      options={
        isHasuraInput
          ? availableHasuraPermissionVariables
          : [
              {
                value: 'X-Hasura-User-Id',
                label: 'X-Hasura-User-Id',
                group: 'Frequently used',
              },
            ]
      }
      onChange={(_event, _value, reason, details) => {
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
