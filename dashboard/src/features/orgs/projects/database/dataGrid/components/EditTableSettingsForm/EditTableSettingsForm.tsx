import { useQueryClient } from '@tanstack/react-query';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import useGetTrackedTablesNames from '@/features/orgs/projects/common/hooks/useGetTrackedTablesNames/useGetTrackedTablesNames';
import { useTrackTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackTableMutation';
import { useUntrackTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUntrackTableMutation';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
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
  const queryClient = useQueryClient();
  const { project } = useProject();

  const { data: trackedTableNames } = useGetTrackedTablesNames({
    dataSource: 'default',
  });
  const trackedTablesSet = new Set(trackedTableNames ?? []);
  const isTracked = trackedTablesSet.has(tableName);

  const { mutateAsync: trackTable, status: trackStatus } =
    useTrackTableMutation({ schema });
  const { mutateAsync: untrackTable, status: untrackStatus } =
    useUntrackTableMutation({ schema });

  const isPending = trackStatus === 'loading' || untrackStatus === 'loading';

  async function handleTrackToggle() {
    const action = isTracked ? 'untrack' : 'track';

    await execPromiseWithErrorToast(
      async () => {
        if (isTracked) {
          await untrackTable({ table: { name: tableName } });
        } else {
          await trackTable({
            table: { name: tableName } as DatabaseTable,
          });
        }
        await queryClient.invalidateQueries({
          queryKey: ['export-metadata', project?.subdomain],
        });
      },
      {
        loadingMessage: `${isTracked ? 'Untracking' : 'Tracking'} table...`,
        successMessage: `Table ${action}ed successfully.`,
        errorMessage: `Failed to ${action} table.`,
      },
    );
  }

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${isTracked ? 'bg-primary' : 'bg-amber-500'}`}
            />
            <span className="font-medium text-sm">
              {isTracked ? 'Tracked in GraphQL' : 'Not tracked in GraphQL'}
            </span>
          </div>
          <ButtonWithLoading
            variant="outline"
            size="sm"
            onClick={handleTrackToggle}
            loading={isPending}
            disabled={disabled || isPending}
          >
            {isTracked ? 'Untrack' : 'Track'}
          </ButtonWithLoading>
        </div>

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
        <Button variant="outline" color="secondary" onClick={handleCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}
