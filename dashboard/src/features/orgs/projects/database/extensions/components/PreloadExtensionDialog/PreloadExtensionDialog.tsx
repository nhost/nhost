import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { PreloadLibraryStep } from '@/features/orgs/projects/database/extensions/components/PreloadLibraryStep';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePreloadLibrary } from '@/features/orgs/projects/database/extensions/hooks/usePreloadLibrary';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

export interface PreloadExtensionDialogProps {
  extension: PostgresExtension;
  dataSource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export default function PreloadExtensionDialog({
  extension,
  dataSource,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: PreloadExtensionDialogProps) {
  const preload = usePreloadLibrary(extension.name, dataSource);
  const displayName = getExtensionDisplayName(extension.name);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !preload.isAdding && onOpenChange(next)}
    >
      <DialogContent
        disableOutsideClick
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-w-lg flex-col"
      >
        <DialogHeader>
          <DialogTitle>Preload {displayName}</DialogTitle>
          <DialogDescription>
            {displayName} only works when Postgres preloads its library.
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite" className="flex flex-col gap-3">
          <PreloadLibraryStep library={extension.name} preload={preload} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={preload.isAdding}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
