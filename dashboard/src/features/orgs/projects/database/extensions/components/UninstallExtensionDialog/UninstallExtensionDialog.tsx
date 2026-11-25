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
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ExtensionSQLEditor } from '@/features/orgs/projects/database/extensions/components/ExtensionSQLEditor';
import { CASCADE_UNINSTALL_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { useSetExtensionInstalledMutation } from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getUninstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getUninstallExtensionSQL';

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

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <AlertDialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[90vh] flex-col overflow-y-auto text-left"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            <span className="block truncate">Uninstall {displayName}</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">
              Are you sure you want to uninstall this extension? Review the SQL
              that will run. You can edit it before uninstalling.
            </span>
            {!cascadeWarning && (
              <span className="mt-2 block">
                Without <InlineCode>CASCADE</InlineCode>, it fails if any
                tables, functions, or other extensions depend on it. With{' '}
                <InlineCode>CASCADE</InlineCode>, those objects and their data
                are dropped too.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {cascadeWarning && (
          <Alert variant="warning">
            <AlertDescription>
              <p className="text-pretty">{cascadeWarning}</p>
              {isPlatform && (
                <p className="mt-2 text-pretty">
                  Daily backups do not include this state; only point-in-time
                  recovery can restore it.{' '}
                  <TextLink
                    href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/settings?tab=point-in-time`}
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
            <AlertDescription className="whitespace-pre-wrap break-words">
              {error.message}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <ButtonWithLoading
              onClick={(event) => {
                event.preventDefault();
                uninstallExtension(
                  { name: extension.name, installed: false, sql },
                  { onSuccess: () => onOpenChange(false) },
                );
              }}
              variant="destructive"
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
