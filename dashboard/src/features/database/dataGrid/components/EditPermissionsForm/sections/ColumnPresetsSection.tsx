import { ControlledSelect } from '@/components/form/ControlledSelect';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import type { RolePermissionEditorFormValues } from '@/features/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { useTableQuery } from '@/features/database/dataGrid/hooks/useTableQuery';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getAllPermissionVariables } from '@/features/projects/permissions/settings/utils/getAllPermissionVariables';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import { useTheme } from '@mui/material';
import clsx from 'clsx';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface ColumnPreset {
  column: string;
  value: string;
}

export interface ColumnPresetSectionProps {
  /**
   * Schema to use for fetching available columns.
   */
  schema: string;
  /**
   * Table to use for fetching available columns.
   */
  table: string;
  /**
   * Determines whether or not the section is disabled.
   */
  disabled?: boolean;
}

export default function ColumnPresetsSection({
  schema,
  table,
  disabled,
}: ColumnPresetSectionProps) {
  const theme = useTheme();
  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${schema}.${table}`], { schema, table });

  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data: permissionVariablesData } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject?.id,
  });
  const {
    setValue,
    formState: { errors },
  } = useFormContext<RolePermissionEditorFormValues>();
  const { fields, append, remove } = useFieldArray({ name: 'columnPresets' });
  const columnPresets = useWatch({ name: 'columnPresets' }) as ColumnPreset[];

  const allColumnNames: string[] =
    tableData?.columns.map((column) => column.column_name) || [];
  const selectedColumns = fields as (ColumnPreset & { id: string })[];
  const selectedColumnsMap = columnPresets.reduce(
    (map, { column }) => map.set(column, true),
    new Map<string, boolean>(),
  );

  if (tableError) {
    throw tableError;
  }

  const permissionVariableOptions = getAllPermissionVariables(
    permissionVariablesData?.config?.auth?.session?.accessToken?.customClaims,
  ).map(({ key }) => ({
    label: `X-Hasura-${key}`,
    value: `X-Hasura-${key}`,
    group: 'Permission variables',
  }));

  return (
    <PermissionSettingsSection title="Column presets" className="gap-6">
      <Text variant="subtitle1">
        Set static values or session variables as pre-determined values for
        columns while inserting.
      </Text>

      <div className="grid grid-flow-row gap-2">
        <div className="grid grid-cols-[1fr_1fr_40px] gap-2">
          <InputLabel as="span">Column Name</InputLabel>
          <InputLabel as="span">Column Value</InputLabel>
        </div>

        {tableStatus === 'loading' && (
          <ActivityIndicator label="Loading columns..." />
        )}

        <div className="grid grid-flow-row gap-4">
          {tableStatus === 'success' &&
            selectedColumns.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_1fr_40px] gap-2"
              >
                <ControlledSelect
                  disabled={disabled}
                  name={`columnPresets.${index}.column`}
                  error={Boolean(
                    errors?.columnPresets?.at(index).column?.message,
                  )}
                >
                  {allColumnNames.map((column) => (
                    <Option
                      value={column}
                      disabled={selectedColumnsMap.has(column)}
                      key={column}
                    >
                      {column}
                    </Option>
                  ))}
                </ControlledSelect>

                <Autocomplete
                  disabled={disabled}
                  options={permissionVariableOptions}
                  groupBy={(option) => option.group}
                  name={`columnPresets.${index}.value`}
                  inputValue={field.value}
                  value={field.value}
                  freeSolo
                  fullWidth
                  disableClearable={false}
                  clearIcon={
                    <XIcon
                      className="mt-px h-4 w-4"
                      sx={{ color: theme.palette.text.primary }}
                    />
                  }
                  autoSelect
                  autoHighlight={false}
                  error={Boolean(
                    errors?.columnPresets?.at(index).value?.message,
                  )}
                  slotProps={{
                    paper: {
                      className: clsx(
                        permissionVariableOptions.length === 0 && 'hidden',
                      ),
                    },
                  }}
                  isOptionEqualToValue={(option, value) => {
                    if (typeof value === 'string') {
                      return (
                        option.value.toLowerCase() ===
                        (value as string).toLowerCase()
                      );
                    }

                    return (
                      option.value.toLowerCase() === value.value.toLowerCase()
                    );
                  }}
                  onChange={(_event, _value, reason, details) => {
                    if (reason === 'clear') {
                      setValue(`columnPresets.${index}.value`, null, {
                        shouldDirty: true,
                      });

                      return;
                    }

                    setValue(
                      `columnPresets.${index}.value`,
                      typeof details.option === 'string'
                        ? details.option
                        : details.option.value,
                      { shouldDirty: true },
                    );
                  }}
                />

                <IconButton
                  disabled={disabled}
                  variant="outlined"
                  color="secondary"
                  className="flex-[40px] shrink-0 grow-0"
                  onClick={() => {
                    if (fields.length === 1) {
                      remove(index);
                      append({ column: '', value: '' });

                      return;
                    }

                    remove(index);
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
        </div>

        <Button
          variant="borderless"
          startIcon={<PlusIcon />}
          size="small"
          onClick={() => append({ column: '', value: '' })}
          disabled={
            selectedColumns.length === allColumnNames.length || disabled
          }
          className="justify-self-start"
        >
          Add Column
        </Button>
      </div>
    </PermissionSettingsSection>
  );
}
