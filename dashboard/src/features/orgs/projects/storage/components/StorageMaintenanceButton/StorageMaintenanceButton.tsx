import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useStorageMaintenance } from '@/features/orgs/projects/storage/hooks/useStorageMaintenance';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function StorageMaintenanceButton() {
  const {
    orphanCount,
    brokenMetadataCount,
    refetch,
    deleteOrphans,
    deleteBroken,
  } = useStorageMaintenance();

  const totalIssues = orphanCount + brokenMetadataCount;

  function handleDeleteOrphans() {
    execPromiseWithErrorToast(
      async () => {
        await deleteOrphans();
        await refetch();
      },
      {
        loadingMessage: 'Deleting orphaned files...',
        successMessage: 'Orphaned files deleted successfully.',
        errorMessage: 'Failed to delete orphaned files.',
      },
    );
  }

  function handleDeleteBroken() {
    execPromiseWithErrorToast(
      async () => {
        await deleteBroken();
        await refetch();
      },
      {
        loadingMessage: 'Deleting broken metadata...',
        successMessage: 'Broken metadata deleted successfully.',
        errorMessage: 'Failed to delete broken metadata.',
      },
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Wrench />
          {totalIssues > 0 && (
            <span className="absolute right-[6px] bottom-[8px] w-[0.625rem] rounded-full bg-primary-text p-0 text-[0.625rem] text-paper leading-none">
              !
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-4 p-4">
        <p className="font-medium text-sm">Storage Maintenance</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {orphanCount > 0
                ? `${orphanCount} orphaned ${orphanCount === 1 ? 'file' : 'files'} found.`
                : 'No orphaned files.'}
            </p>
            {orphanCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleDeleteOrphans}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {brokenMetadataCount > 0
                ? `${brokenMetadataCount} broken metadata ${brokenMetadataCount === 1 ? 'entry' : 'entries'} found.`
                : 'No broken metadata.'}
            </p>
            {brokenMetadataCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleDeleteBroken}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
