import { useFormContext, useWatch } from 'react-hook-form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { Spinner } from '@/components/ui/v3/spinner';
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
  action: Exclude<DatabaseAction, 'delete'>;
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
  const { setValue } = useFormContext<RolePermissionEditorFormValues>();
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

  const isSelectAction = action === 'select';
  const showComputedFields =
    isSelectAction && availableComputedFields.length > 0;

  const selectableColumns =
    (isSelectAction
      ? tableData?.columns
      : tableData?.columns?.filter((column) => !isGeneratedColumn(column))) ??
    [];

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
        <p>
          Allow role <HighlightedText>{role}</HighlightedText> to{' '}
          <HighlightedText>{action}</HighlightedText> columns:
        </p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
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

      {tableStatus === 'loading' && <Spinner>Loading columns...</Spinner>}

      {tableStatus === 'success' && (
        <div className="flex flex-row flex-wrap items-center justify-start gap-6">
          {tableData?.columns?.map((column) => {
            const isDisabledGeneratedColumn =
              !isSelectAction && isGeneratedColumn(column);

            if (isDisabledGeneratedColumn) {
              return (
                <Tooltip key={column.column_name}>
                  <TooltipTrigger asChild>
                    <Label
                      htmlFor={`column-${column.column_name}`}
                      className="flex cursor-not-allowed flex-row-reverse items-center justify-center gap-2"
                    >
                      {column.column_name}

                      <Checkbox id={`column-${column.column_name}`} disabled />
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    Generated column — value is computed by Postgres, can't be{' '}
                    {action === 'insert' ? 'inserted' : 'updated'}.
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={column.column_name} className="flex items-center gap-2">
                <Checkbox
                  id={`column-${column.column_name}`}
                  checked={selectedColumns.includes(column.column_name)}
                  onCheckedChange={(c) =>
                    setValue(
                      'columns',
                      c
                        ? [...selectedColumns, column.column_name]
                        : selectedColumns.filter(
                            (v) => v !== column.column_name,
                          ),
                      { shouldDirty: true },
                    )
                  }
                />
                <Label
                  htmlFor={`column-${column.column_name}`}
                  className="cursor-pointer"
                >
                  {column.column_name}
                </Label>
              </div>
            );
          })}
          {showComputedFields &&
            availableComputedFields.map((fieldName) => (
              <div
                key={`computed-${fieldName}`}
                className="flex items-center gap-2"
              >
                <Checkbox
                  id={`computed-${fieldName}`}
                  checked={selectedComputedFields?.includes(fieldName) ?? false}
                  onCheckedChange={(c) => {
                    const current = selectedComputedFields ?? [];
                    setValue(
                      'computedFields',
                      c
                        ? [...current, fieldName]
                        : current.filter((v) => v !== fieldName),
                      { shouldDirty: true },
                    );
                  }}
                />
                <Label htmlFor={`computed-${fieldName}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="italic">{fieldName}</span>
                    </TooltipTrigger>
                    <TooltipContent>Computed field</TooltipContent>
                  </Tooltip>
                </Label>
              </div>
            ))}
        </div>
      )}

      <p className="text-muted-foreground">
        For <strong>relationships</strong>, set permissions for the
        corresponding tables/views.
      </p>
    </PermissionSettingsSection>
  );
}
