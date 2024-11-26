import { HighlightedText } from '@/components/presentational/HighlightedText';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useFormContext, useWatch } from 'react-hook-form';
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
   * Determines whether or not the section is disabled.
   */
  disabled?: boolean;
}

export default function ColumnPermissionsSection({
  role,
  action,
  schema,
  table,
  disabled,
}: ColumnPermissionsSectionProps) {
  const { register, setValue } =
    useFormContext<RolePermissionEditorFormValues>();
  const selectedColumns = useWatch({ name: 'columns' }) as string[];

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${schema}.${table}`], { schema, table });

  if (tableError) {
    throw tableError;
  }

  const isAllSelected = selectedColumns?.length === tableData?.columns?.length;

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
          disabled={disabled}
          onClick={() => {
            if (isAllSelected) {
              setValue('columns', []);

              return;
            }

            setValue(
              'columns',
              tableData?.columns?.map((column) => column.column_name),
            );
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
              disabled={disabled}
              name="columns"
              value={column.column_name}
              label={column.column_name}
              key={column.column_name}
              checked={selectedColumns.includes(column.column_name)}
              {...register('columns')}
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
