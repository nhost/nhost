import { Fragment, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ExtensionSQLEditor } from '@/features/orgs/projects/database/extensions/components/ExtensionSQLEditor';
import { PRELOAD_LIBRARY_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import type { PreloadLibrary } from '@/features/orgs/projects/database/extensions/hooks/usePreloadLibrary';
import { usePreloadLibrary } from '@/features/orgs/projects/database/extensions/hooks/usePreloadLibrary';
import {
  getInstallExtensionSQL,
  useSetExtensionInstalledMutation,
} from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { getMissingExtensionDependencies } from '@/features/orgs/projects/database/extensions/utils/getMissingExtensionDependencies';
import { cn } from '@/lib/utils';
import InstallStep from './InstallStep';
import PreloadLibraryStep from './PreloadLibraryStep';

export interface InstallExtensionDialogProps {
  extension: PostgresExtension;
  /**
   * Every extension available to the database.
   */
  catalog: PostgresExtension[];
  dataSource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

interface InstallExtensionDialogContentProps
  extends InstallExtensionDialogProps {
  /**
   * Set when the extension needs a preloaded library; adds a step to preload
   * it before installing.
   */
  preload?: PreloadLibrary;
}

function InstallExtensionDialogContent({
  extension,
  catalog,
  dataSource,
  open,
  onOpenChange,
  onCloseAutoFocus,
  preload,
}: InstallExtensionDialogContentProps) {
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
  const displayName = getExtensionDisplayName(extension.name);
  const missingDependencies = getMissingExtensionDependencies(
    extension,
    catalog,
  );
  const canInstall = !preload || preload.status === 'preloaded';
  // Shown in a tooltip on a wrapper around the disabled Install button, which
  // gets no pointer events itself.
  let installBlockedReason: string | null = null;

  if (!canInstall) {
    installBlockedReason = [
      'restarting',
      'pending-local-restart',
      'restart-failed',
    ].includes(preload?.status ?? '')
      ? `Postgres has not loaded ${extension.name} yet.`
      : `Add ${extension.name} to preloaded libraries first.`;
  }

  const installButtonRef = useRef<HTMLButtonElement>(null);
  const couldInstall = useRef(canInstall);

  useEffect(() => {
    if (canInstall && !couldInstall.current) {
      installButtonRef.current?.focus();
    }

    couldInstall.current = canInstall;
  }, [canInstall]);

  const installFields = (
    <>
      <ExtensionSQLEditor
        value={sql}
        onChange={setSql}
        editable={!isPending}
        disabled={!canInstall}
      />

      {missingDependencies.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Also installs{' '}
          {missingDependencies.map((dependency, index) => (
            <Fragment key={dependency}>
              {index > 0 && ', '}
              <InlineCode>{dependency}</InlineCode>
            </Fragment>
          ))}
          , which {displayName} depends on.
        </p>
      )}

      {extension.name === 'pg_squeeze' && (
        <p className="text-muted-foreground text-sm">
          Squeezing tables may require configuring the WAL level and replication
          slots in your Postgres settings.{' '}
          <TextLink href={getExtensionDocsUrl(extension.name)} external>
            Learn more
          </TextLink>
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not install {displayName}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap break-words">
            {error.message}
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent
        disableOutsideClick
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[90vh] max-w-2xl flex-col gap-5 overflow-y-auto text-foreground"
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
            disabled={isPending}
          >
            Cancel
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={installBlockedReason ? 0 : undefined}
                className={cn(
                  'inline-flex',
                  installBlockedReason && 'cursor-not-allowed',
                )}
              >
                <ButtonWithLoading
                  ref={installButtonRef}
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
              </span>
            </TooltipTrigger>
            {installBlockedReason && (
              <TooltipContent>{installBlockedReason}</TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreloadInstallExtensionDialog(props: InstallExtensionDialogProps) {
  const preload = usePreloadLibrary(props.extension.name, props.dataSource);

  return <InstallExtensionDialogContent {...props} preload={preload} />;
}

export default function InstallExtensionDialog(
  props: InstallExtensionDialogProps,
) {
  if (PRELOAD_LIBRARY_EXTENSIONS.has(props.extension.name)) {
    return <PreloadInstallExtensionDialog {...props} />;
  }

  return <InstallExtensionDialogContent {...props} />;
}
