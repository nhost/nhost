import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import ControlledSelect from '@/components/common/ControlledSelect';
import ReadOnlyToggle from '@/components/common/ReadOnlyToggle';
import ColumnAutocomplete from '@/components/dataBrowser/ColumnAutocomplete';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { HasuraOperator } from '@/types/dataBrowser';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Option from '@/ui/v2/Option';
import getPermissionVariablesArray from '@/utils/settings/getPermissionVariablesArray';
import { useGetAppCustomClaimsQuery } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useFormContext, useWatch } from 'react-hook-form';

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

export default function RuleValueInput({
  name,
  selectedTablePath,
}: RuleValueInputProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { setValue } = useFormContext();
  const inputName = `${name}.value`;
  const operator: HasuraOperator = useWatch({ name: `${name}.operator` });
  const isHasuraInput = operator === '_in_hasura' || operator === '_nin_hasura';
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();

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
      <ColumnAutocomplete
        disableRelationships
        schema={schemaSlug as string}
        table={tableSlug as string}
        rootClassName="flex-auto"
        slotProps={{
          input: { className: 'lg:!rounded-none !bg-white !z-10' },
        }}
        onChange={(_event, { value }) => {
          if (selectedTablePath === `${schemaSlug}.${tableSlug}`) {
            setValue(inputName, [value], { shouldDirty: true });
            return;
          }

          // For more information, see https://github.com/hasura/graphql-engine/issues/3459#issuecomment-1085666541
          setValue(inputName, ['$', value], { shouldDirty: true });
        }}
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
