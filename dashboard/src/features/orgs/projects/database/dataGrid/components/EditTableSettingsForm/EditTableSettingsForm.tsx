import { Button } from '@/components/ui/v3/button';
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
   * Table's name that is being edited/viewed.
   */
  tableName: string;
  /**
   * Whether the form is disabled, if true, the form will be read-only.
   */
  disabled?: boolean;
}

export default function EditTableSettingsForm({
  onCancel,
  schema,
  tableName,
  disabled,
}: EditTableSettingsFormProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <ColumnsNameCustomizationSection
          disabled={disabled}
          schema={schema}
          tableName={tableName}
        />
        <CustomGraphQLRootFieldsSection
          disabled={disabled}
          schema={schema}
          tableName={tableName}
        />
        <SetIsEnumSection
          disabled={disabled}
          schema={schema}
          tableName={tableName}
        />
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
