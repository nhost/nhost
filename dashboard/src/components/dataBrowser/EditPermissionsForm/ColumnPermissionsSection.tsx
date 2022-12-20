import HighlightedText from '@/components/common/HighlightedText';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import type { DatabaseAction } from '@/types/dataBrowser';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import Text from '@/ui/v2/Text';
import { useFormContext, useWatch } from 'react-hook-form';

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
}

export default function ColumnPermissionsSection({
  role,
  action,
  schema,
  table,
}: ColumnPermissionsSectionProps) {
  const { register, setValue } = useFormContext();
  const selectedColumns = useWatch({ name: 'columns' }) as string[];

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${schema}.${table}`]);

  if (tableError) {
    throw tableError;
  }

  const isAllSelected = selectedColumns?.length === tableData?.columns?.length;

  return (
    <section className="bg-white border-y-1 border-gray-200">
      <Text
        component="h2"
        className="px-6 py-3 font-bold border-b-1 border-gray-200"
      >
        Column select permissions
      </Text>

      <div className="grid grid-flow-row gap-4 items-center px-6 py-4">
        <div className="grid grid-flow-col justify-between gap-2 items-center">
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
          <div className="flex flex-row gap-6 justify-start flex-wrap items-center">
            {tableData?.columns?.map((column) => (
              <Checkbox
                name="columns"
                value={column.column_name}
                label={column.column_name}
                key={column.column_name}
                checked={selectedColumns.indexOf(column.column_name) !== -1}
                {...register('columns')}
              />
            ))}
          </div>
        )}

        <Text variant="subtitle1">
          For <strong>relationships</strong>, set permissions for the
          corresponding tables/views.
        </Text>
      </div>
    </section>
  );
}
