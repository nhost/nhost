import { Button } from '@/components/ui/v3/button';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { ColumnsNameCustomizationSection } from './sections/ColumnsNameCustomizationSection';
import { CustomGraphQLRootFieldsSection } from './sections/CustomGraphQLRootFieldsSection';
import { SetIsEnumSection } from './sections/SetIsEnumSection';

export interface EditTableSettingsFormProps {
  /**
   * Function to be called when the form is closed.
   */
  onCancel?: () => void;
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
  table,
}: EditTableSettingsFormProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <ColumnsNameCustomizationSection
          schema={schema}
          tableName={table.table_name}
        />
        <CustomGraphQLRootFieldsSection
          schema={schema}
          tableName={table.table_name}
        />
        <SetIsEnumSection schema={schema} tableName={table.table_name} />
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button
          variant="outline"
          color="secondary"
          onClick={() => onCancel?.()}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
