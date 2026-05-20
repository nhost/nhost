import { useFormContext, useWatch } from 'react-hook-form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isGeneratedColumn } from '@/features/orgs/projects/database/dataGrid/utils/isGeneratedColumn';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface ColumnPermissionsSectionProps {
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
  /**
   * Names of computed fields configured on the table. Rendered as additional
   * checkboxes for the `select` action only.
   */
  availableComputedFields?: string[];
}

export default function ColumnPermissionsSection({
  role,
  action,
  schema,
  table,
  availableComputedFields = [],
}: ColumnPermissionsSectionProps) {
  const { register, setValue } =
    useFormContext<RolePermissionEditorFormValues>();
  const selectedColumns = useWatch({ name: 'columns' }) as string[];
  const selectedComputedFields = useWatch({ name: 'computedFields' }) as
    | string[]
    | undefined;

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableSchemaQuery([`default.${schema}.${table}`], { schema, table });

  if (tableError) {
    throw tableError;
  }

  const showComputedFields =
    action === 'select' && availableComputedFields.length > 0;
  const isWriteAction = action === 'insert' || action === 'update';

  const selectableColumns =
    tableData?.columns?.filter(
      (column) => !(isWriteAction && isGeneratedColumn(column)),
    ) ?? [];

  const isAllSelected =
    selectableColumns.length > 0 &&
    selectableColumns.every((column) =>
      selectedColumns.includes(column.column_name),
    ) &&
    (!showComputedFields ||
      selectedComputedFields?.length === availableComputedFields.length);

  return (
    <PermissionSettingsSection title={`Column ${action} permissions`}>
      <div className="grid grid-flow-col items-center justify-between gap-2">
        <Text>
          Allow role <HighlightedText>{role}</HighlightedText> to{' '}
          <HighlightedText>{action}</HighlightedText> columns:
        </Text>

        <Button
          variant="borderless"
          size="small"
          onClick={() => {
            if (isAllSelected) {
              setValue('columns', []);
              if (showComputedFields) {
                setValue('computedFields', []);
              }

              return;
            }

            setValue(
              'columns',
              selectableColumns.map((column) => column.column_name),
            );
            if (showComputedFields) {
              setValue('computedFields', availableComputedFields);
            }
          }}
        >
          {isAllSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {tableStatus === 'loading' && (
        <ActivityIndicator label="Loading columns..." />
      )}

      {tableStatus === 'success' && (
        <div className="flex flex-row flex-wrap items-center justify-start gap-6">
          {tableData?.columns?.map((column) => {
            const disabledForGenerated =
              isWriteAction && isGeneratedColumn(column);

            if (!disabledForGenerated) {
              return (
                <Checkbox
                  key={column.column_name}
                  value={column.column_name}
                  label={column.column_name}
                  checked={selectedColumns.includes(column.column_name)}
                  {...register('columns')}
                />
              );
            }

            return (
              <Tooltip key={column.column_name}>
                <TooltipTrigger asChild>
                  <span className="inline-block cursor-not-allowed">
                    <Checkbox
                      className="pointer-events-none"
                      value={column.column_name}
                      label={column.column_name}
                      checked={selectedColumns.includes(column.column_name)}
                      disabled
                      {...register('columns')}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Generated column — value is computed by Postgres, can't be{' '}
                  {action === 'insert' ? 'inserted' : 'updated'}.
                </TooltipContent>
              </Tooltip>
            );
          })}
          {showComputedFields &&
            availableComputedFields.map((fieldName) => (
              <Checkbox
                value={fieldName}
                label={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="italic">{fieldName}</span>
                    </TooltipTrigger>
                    <TooltipContent>Computed field</TooltipContent>
                  </Tooltip>
                }
                key={`computed-${fieldName}`}
                checked={selectedComputedFields?.includes(fieldName) ?? false}
                {...register('computedFields')}
              />
            ))}
        </div>
      )}

      <Text variant="subtitle1">
        For <strong>relationships</strong>, set permissions for the
        corresponding tables/views.
      </Text>
    </PermissionSettingsSection>
  );
}
