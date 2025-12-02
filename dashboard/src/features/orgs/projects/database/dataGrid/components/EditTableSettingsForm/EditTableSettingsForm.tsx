import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import type { BaseTableFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useRouter } from 'next/router';
import { ColumnsNameCustomizationSection } from './sections/ColumnsNameCustomizationSection';
import { CustomGraphQLRootFieldsSection } from './sections/CustomGraphQLRootFieldsSection';
import { SetIsEnumSection } from './sections/SetIsEnumSection';

export interface EditTableSettingsFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table to be edited.
   */
  table: NormalizedQueryDataRow;
}

export default function EditTableSettingsForm({
  onCancel,
  schema,
  table: originalTable,
}: EditTableSettingsFormProps) {
  const router = useRouter();

  const { status: columnsStatus, error: columnsError } = useTableQuery(
    [`default.${schema}.${originalTable.table_name}`],
    {
      schema,
      table: originalTable.table_name,
    },
  );

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    router.back();
  };

  if (columnsStatus === 'loading') {
    return (
      <div className="px-6">
        <ActivityIndicator label="Loading columns..." delay={1000} />
      </div>
    );
  }

  if (columnsStatus === 'error') {
    return (
      <div className="-mt-3 px-6">
        <Alert severity="error" className="text-left">
          <strong>Error:</strong>{' '}
          {columnsError && columnsError instanceof Error
            ? columnsError?.message
            : 'An error occurred while loading the columns. Please try again.'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <ColumnsNameCustomizationSection
          schema={schema}
          tableName={originalTable.table_name}
        />
        <CustomGraphQLRootFieldsSection
          schema={schema}
          tableName={originalTable.table_name}
        />
        <SetIsEnumSection
          schema={schema}
          tableName={originalTable.table_name}
        />
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button variant="outline" color="secondary" onClick={handleCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}
