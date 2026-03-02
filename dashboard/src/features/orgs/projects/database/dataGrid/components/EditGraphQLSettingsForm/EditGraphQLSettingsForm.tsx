import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsTrackedTable } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedTable';
import { useSetTableTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { ColumnsNameCustomizationSection } from './sections/ColumnsNameCustomizationSection';
import { CustomGraphQLRootFieldsSection } from './sections/CustomGraphQLRootFieldsSection';
import { SetIsEnumSection } from './sections/SetIsEnumSection';
import { TrackUntrackSection } from './sections/TrackUntrackSection';

export interface EditGraphQLSettingsFormProps {
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

export default function EditGraphQLSettingsForm({
  onCancel,
  schema,
  tableName,
  disabled,
}: EditGraphQLSettingsFormProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;

  const { data: isTracked } = useIsTrackedTable({
    dataSource: dataSourceSlug as string,
    schema,
    tableName,
  });

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: setTableTracking, isPending: isTrackingPending } =
    useSetTableTrackingMutation();

  async function handleTrackToggle() {
    const tracked = !isTracked;
    const action = tracked ? 'track' : 'untrack';

    await execPromiseWithErrorToast(
      async () => {
        await setTableTracking({
          tracked,
          resourceVersion,
          args: {
            source: dataSourceSlug as string,
            table: { name: tableName, schema },
          },
        });
      },
      {
        loadingMessage: `${tracked ? 'Tracking' : 'Untracking'} table...`,
        successMessage: `Table ${action}ed successfully.`,
        errorMessage: `Failed to ${action} table.`,
      },
    );
  }

  const isUntracked = !isTracked;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <TrackUntrackSection
          isTracked={isTracked}
          isPending={isTrackingPending}
          onTrackToggle={handleTrackToggle}
          disabled={disabled}
        />

        <ColumnsNameCustomizationSection
          disabled={disabled || isTrackingPending}
          isUntracked={isUntracked}
          schema={schema}
          tableName={tableName}
        />
        <CustomGraphQLRootFieldsSection
          disabled={disabled || isTrackingPending}
          isUntracked={isUntracked}
          schema={schema}
          tableName={tableName}
        />
        <SetIsEnumSection
          disabled={disabled || isTrackingPending}
          isUntracked={isUntracked}
          schema={schema}
          tableName={tableName}
        />
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button variant="outline" color="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}
