import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { ButtonWithLoading, buttonVariants } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import { ExtensionSQLEditor } from '@/features/orgs/projects/database/extensions/components/ExtensionSQLEditor';
import { CASCADE_UNINSTALL_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import {
  ExtensionChangeError,
  getUninstallExtensionSQL,
  useSetExtensionInstalledMutation,
} from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

export interface UninstallExtensionDialogProps {
  extension: PostgresExtension;
  dataSource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export default function UninstallExtensionDialog({
  extension,
  dataSource,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: UninstallExtensionDialogProps) {
  const {
    query: { orgSlug, appSubdomain },
  } = useRouter();
  const isPlatform = useIsPlatform();
  const {
    mutate: uninstallExtension,
    isPending,
    error,
  } = useSetExtensionInstalledMutation(dataSource);
  const [sql, setSql] = useState(() =>
    getUninstallExtensionSQL(extension.name),
  );
  const displayName = getExtensionDisplayName(extension.name);
  const cascadeWarning = CASCADE_UNINSTALL_EXTENSIONS.get(extension.name);
  const hasDependents =
    error instanceof ExtensionChangeError &&
    error.code === POSTGRESQL_ERROR_CODES.DEPENDENT_OBJECTS_STILL_EXIST;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <AlertDialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex w-[32rem] max-w-[32rem] flex-col gap-6 p-6 text-left text-foreground"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="truncate">
            Uninstall {displayName}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Are you sure you want to uninstall this extension? Review the SQL
              that will run. You can edit it before uninstalling.
            </span>
            {!cascadeWarning && (
              <span className="block">
                Without{' '}
                <InlineCode className="px-1.5 text-sm">CASCADE</InlineCode>, it
                fails if any tables, functions, or other extensions depend on
                it.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {cascadeWarning && (
          <Alert variant="warning">
            <TriangleAlert className="size-5" aria-hidden />
            <AlertDescription className="space-y-2 text-pretty">
              <p>{cascadeWarning}</p>
              {isPlatform && (
                <p>
                  Daily backups do not include this state; only point-in-time
                  recovery can restore it.{' '}
                  <TextLink
                    href={`/orgs/${orgSlug}/projects/${appSubdomain}/settings/database`}
                  >
                    Point-in-time recovery settings
                  </TextLink>
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <ExtensionSQLEditor
          value={sql}
          onChange={setSql}
          editable={!isPending}
          height="100px"
        />

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not uninstall {displayName}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="whitespace-pre-wrap break-words">{error.message}</p>
              {hasDependents && (
                <p className="text-foreground">
                  Remove the dependent objects first, or add{' '}
                  <InlineCode className="px-1.5 text-sm">CASCADE</InlineCode> to
                  the SQL above, which also drops every object that depends on
                  the extension.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <ButtonWithLoading
              onClick={(event) => {
                // Keep the dialog open until the uninstall succeeds.
                event.preventDefault();
                uninstallExtension(
                  { name: extension.name, installed: false, sql },
                  { onSuccess: () => onOpenChange(false) },
                );
              }}
              className={buttonVariants({ variant: 'destructive' })}
              loading={isPending}
              disabled={!sql.trim()}
              data-testid="confirm-uninstall-extension"
            >
              Uninstall
            </ButtonWithLoading>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
