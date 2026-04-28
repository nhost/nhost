import { Plus, X } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getAllPermissionVariables } from '@/features/orgs/projects/permissions/settings/utils/getAllPermissionVariables';
import { cn } from '@/lib/utils';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import ColumnPresetValueCombobox from './ColumnPresetValueCombobox';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface ColumnPreset {
  column: string;
  value: string;
}

export interface ColumnPresetSectionProps {
  schema: string;
  table: string;
}

export default function ColumnPresetsSection({
  schema,
  table,
}: ColumnPresetSectionProps) {
  const { data: tableData, error: tableError } = useTableSchemaQuery(
    [`default.${schema}.${table}`],
    { schema, table },
  );

  const { project } = useProject();

  const { data: permissionVariablesData } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
  });
  const {
    control,
    formState: { errors },
  } = useFormContext<RolePermissionEditorFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columnPresets',
  });
  const columnPresets = useWatch({
    control,
    name: 'columnPresets',
  }) as ColumnPreset[];

  const allColumnNames: string[] =
    tableData?.columns.map((column) => column.column_name) || [];
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
  }));

  return (
    <PermissionSettingsSection title="Column presets" className="gap-6">
      <p className="text-secondary text-sm">
        Set static values or session variables as pre-determined values for
        columns while inserting.
      </p>

      <div className="grid grid-flow-row gap-2">
        <div className="grid grid-cols-[1fr_1fr_40px] gap-2">
          <span className="font-medium text-sm">Column Name</span>
          <span className="font-medium text-sm">Column Value</span>
        </div>

        <div className="grid grid-flow-row gap-4">
          {fields.map((field, index) => {
            const columnError =
              errors?.columnPresets?.at?.(index)?.column?.message;
            const valueError =
              errors?.columnPresets?.at?.(index)?.value?.message;

            return (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_1fr_40px] gap-2"
              >
                <Controller
                  name={`columnPresets.${index}.column`}
                  control={control}
                  render={({ field: columnField }) => (
                    <Select
                      value={columnField.value || undefined}
                      onValueChange={columnField.onChange}
                    >
                      <SelectTrigger
                        className={cn(
                          Boolean(columnError) &&
                            'border-destructive text-destructive',
                        )}
                      >
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {allColumnNames.map((column) => (
                          <SelectItem
                            key={column}
                            value={column}
                            disabled={
                              selectedColumnsMap.has(column) &&
                              columnField.value !== column
                            }
                          >
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />

                <ColumnPresetValueCombobox
                  name={`columnPresets.${index}.value`}
                  options={permissionVariableOptions}
                  hasError={Boolean(valueError)}
                />

                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  aria-label="Delete preset"
                  onClick={() => {
                    if (fields.length === 1) {
                      remove(index);
                      append({ column: '', value: '' });
                      return;
                    }
                    remove(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => append({ column: '', value: '' })}
          disabled={fields.length === allColumnNames.length}
          className="justify-self-start text-primary hover:text-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Column
        </Button>
      </div>
    </PermissionSettingsSection>
  );
}
