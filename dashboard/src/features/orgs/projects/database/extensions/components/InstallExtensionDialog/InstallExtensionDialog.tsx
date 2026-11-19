import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { InstallExtensionFields } from '@/features/orgs/projects/database/extensions/components/InstallExtensionFields';
import { PreloadLibraryStep } from '@/features/orgs/projects/database/extensions/components/PreloadLibraryStep';
import { PRELOAD_LIBRARY_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePreloadLibrary } from '@/features/orgs/projects/database/extensions/hooks/usePreloadLibrary';
import { useSetExtensionInstalledMutation } from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getInstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getInstallExtensionSQL';
import InstallStep from './InstallStep';

export interface InstallExtensionDialogProps {
  extension: PostgresExtension;
  catalog: PostgresExtension[];
  dataSource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export default function InstallExtensionDialog({
  extension,
  catalog,
  dataSource,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: InstallExtensionDialogProps) {
  const needsPreload = PRELOAD_LIBRARY_EXTENSIONS.has(extension.name);
  const preloadLibrary = usePreloadLibrary(extension.name, dataSource, {
    enabled: needsPreload,
  });
  const preload = needsPreload ? preloadLibrary : undefined;
  const {
    mutate: installExtension,
    isPending,
    error,
  } = useSetExtensionInstalledMutation(dataSource);
  const [sql, setSql] = useState(() =>
    getInstallExtensionSQL(extension.name, {
      cascade: extension.requires.length > 0,
    }),
  );
  const isBusy = isPending || Boolean(preload?.isAdding);
  const displayName = getExtensionDisplayName(extension.name);
  const canInstall = !preload || preload.status === 'preloaded';

  const installFields = (
    <InstallExtensionFields
      extension={extension}
      catalog={catalog}
      sql={sql}
      onSqlChange={setSql}
      editable={!isPending}
      disabled={!canInstall}
      error={error}
    />
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent
        disableOutsideClick
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[90vh] max-w-2xl flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Install {displayName}</DialogTitle>
          <DialogDescription>
            {preload
              ? `${displayName} needs Postgres to preload its library before it can be installed.`
              : 'Review the SQL that will run. You can edit it before installing.'}
          </DialogDescription>
        </DialogHeader>

        {preload ? (
          <ol className="flex flex-col">
            <InstallStep
              number={1}
              title="Add to preloaded libraries"
              state={canInstall ? 'complete' : 'current'}
            >
              <div aria-live="polite" className="flex flex-col gap-3">
                <PreloadLibraryStep
                  library={extension.name}
                  preload={preload}
                />
              </div>
            </InstallStep>
            <InstallStep
              number={2}
              title="Install extension"
              state={canInstall ? 'current' : 'upcoming'}
              isLast
            >
              <p className="text-muted-foreground text-sm">
                Review the SQL that will run. You can edit it before installing.
              </p>
              {installFields}
            </InstallStep>
          </ol>
        ) : (
          installFields
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <ButtonWithLoading
            onClick={() =>
              installExtension(
                { name: extension.name, installed: true, sql },
                { onSuccess: () => onOpenChange(false) },
              )
            }
            loading={isPending}
            disabled={!sql.trim() || !canInstall}
            data-testid="confirm-install-extension"
          >
            Install
          </ButtonWithLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
