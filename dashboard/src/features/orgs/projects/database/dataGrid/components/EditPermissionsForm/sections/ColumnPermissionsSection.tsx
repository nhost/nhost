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

  const isAllSelected =
    selectedColumns?.length === tableData?.columns?.length &&
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
              tableData?.columns?.map((column) => column.column_name),
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
          {tableData?.columns?.map((column) => (
            <Checkbox
              value={column.column_name}
              label={column.column_name}
              key={column.column_name}
              checked={selectedColumns.includes(column.column_name)}
              {...register('columns')}
            />
          ))}
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
