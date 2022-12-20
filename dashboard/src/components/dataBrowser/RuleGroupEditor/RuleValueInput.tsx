import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import ControlledSelect from '@/components/common/ControlledSelect';
import ReadOnlyToggle from '@/components/common/ReadOnlyToggle';
import type { ColumnAutocompleteProps } from '@/components/dataBrowser/ColumnAutocomplete';
import ColumnAutocomplete from '@/components/dataBrowser/ColumnAutocomplete';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { HasuraOperator } from '@/types/dataBrowser';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Option from '@/ui/v2/Option';
import getPermissionVariablesArray from '@/utils/settings/getPermissionVariablesArray';
import { useGetAppCustomClaimsQuery } from '@/utils/__generated__/graphql';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import useRuleGroupEditor from './useRuleGroupEditor';

export interface RuleValueInputProps {
  /**
   * Name of the parent group editor.
   */
  name: string;
  /**
   * Path of the table selected through the column input.
   */
  selectedTablePath?: string;
}

function ColumnSelectorInput({
  name,
  selectedTablePath,
  schema,
  table,
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
      value={
        // this array can either be ['$', 'columnName'] or ['columnName']
        Array.isArray(field.value) ? field.value.slice(-1)[0] : field.value
      }
      schema={schema}
      table={table}
      disableRelationships
      rootClassName="flex-auto"
      slotProps={{
        input: { className: 'lg:!rounded-none !bg-white !z-10' },
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

export default function RuleValueInput({
  name,
  selectedTablePath,
}: RuleValueInputProps) {
  const { schema, table } = useRuleGroupEditor();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { setValue } = useFormContext();
  const inputName = `${name}.value`;
  const operator: HasuraOperator = useWatch({ name: `${name}.operator` });
  const isHasuraInput = operator === '_in_hasura' || operator === '_nin_hasura';

  const { data, loading, error } = useGetAppCustomClaimsQuery({
    variables: { id: currentApplication?.id },
    skip: !isHasuraInput,
  });

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

  if (operator === '_in' || operator === '_nin') {
    return (
      <ControlledAutocomplete
        name={inputName}
        multiple
        freeSolo
        limitTags={5}
        className="flex-auto"
        slotProps={{ input: { className: 'lg:!rounded-none !bg-white !z-10' } }}
        options={[]}
        fullWidth
        filterSelectedOptions
      />
    );
  }

  if (['_ceq', '_cne', '_cgt', '_clt', '_cgte', '_clte'].includes(operator)) {
    return (
      <ColumnSelectorInput
        selectedTablePath={selectedTablePath}
        schema={schema}
        table={table}
        name={inputName}
      />
    );
  }

  const availableHasuraPermissionVariables = !loading
    ? getPermissionVariablesArray(data?.app?.authJwtCustomClaims).map(
        ({ key }) => ({
          value: `X-Hasura-${key}`,
          label: `X-Hasura-${key}`,
        }),
      )
    : [];

  return (
    <ControlledAutocomplete
      freeSolo={!isHasuraInput}
      autoSelect={!isHasuraInput}
      autoHighlight={isHasuraInput}
      name={inputName}
      className="flex-auto"
      slotProps={{
        input: { className: 'lg:!rounded-none !bg-white' },
        formControl: { className: '!bg-transparent' },
      }}
      fullWidth
      loading={loading}
      loadingText={<ActivityIndicator label="Loading..." />}
      error={!!error}
      helperText={error?.message}
      options={
        isHasuraInput
          ? availableHasuraPermissionVariables
          : [{ value: 'X-Hasura-User-Id', label: 'X-Hasura-User-Id' }]
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
