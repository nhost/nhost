import { useRouter } from 'next/router';
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
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { useSetExtensionInstalledMutation } from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';

export interface UninstallExtensionDialogProps {
  extension: PostgresExtension;
  dataSource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UninstallExtensionDialog({
  extension,
  dataSource,
  open,
  onOpenChange,
}: UninstallExtensionDialogProps) {
  const {
    query: { orgSlug, appSubdomain },
  } = useRouter();
  const {
    mutate: uninstallExtension,
    isPending,
    error,
  } = useSetExtensionInstalledMutation(dataSource);
  const displayName = getExtensionDisplayName(extension.name);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <AlertDialogContent className="flex w-[32rem] max-w-[32rem] flex-col gap-6 p-6 text-left text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle className="truncate">
            Uninstall {displayName}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Are you sure you want to uninstall this extension? This runs{' '}
              <InlineCode className="px-1.5 text-sm">
                DROP EXTENSION IF EXISTS {extension.name}
              </InlineCode>{' '}
              without{' '}
              <InlineCode className="px-1.5 text-sm">CASCADE</InlineCode>.
            </span>
            <span className="block">
              It fails if any tables, functions, or other extensions depend on
              it.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not uninstall {displayName}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="whitespace-pre-wrap break-words">{error.message}</p>
              <p className="text-foreground">
                Remove the dependent objects first, or drop the extension
                manually in the{' '}
                <TextLink
                  href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSource}/editor`}
                >
                  SQL editor
                </TextLink>
                .
              </p>
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
                  { name: extension.name, installed: false },
                  { onSuccess: () => onOpenChange(false) },
                );
              }}
              className={buttonVariants({ variant: 'destructive' })}
              loading={isPending}
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
