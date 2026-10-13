import { useRouter } from 'next/router';
import { useState } from 'react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { PreloadLibrary } from '@/features/orgs/projects/database/extensions/hooks/usePreloadLibrary';

export interface PreloadLibraryStepProps {
  library: string;
  preload: PreloadLibrary;
}

function Progress({ children }: { children: string }) {
  return (
    <Spinner
      size="xs"
      wrapperClassName="flex-row justify-start gap-2 text-muted-foreground text-sm"
    >
      {children}
    </Spinner>
  );
}

export default function PreloadLibraryStep({
  library,
  preload,
}: PreloadLibraryStepProps) {
  const {
    query: { orgSlug, appSubdomain },
  } = useRouter();
  const isPlatform = useIsPlatform();
  const [addError, setAddError] = useState<string | null>(null);
  const [hasCheckedAgain, setHasCheckedAgain] = useState(false);

  async function handleAdd() {
    setAddError(null);

    try {
      await preload.addLibrary();
    } catch (error) {
      setAddError(
        error instanceof Error
          ? error.message
          : 'Could not update the project settings.',
      );
    }
  }

  async function handleCheckAgain() {
    await preload.checkAgain();
    setHasCheckedAgain(true);
  }

  switch (preload.status) {
    case 'loading':
      return <Progress>Checking the preloaded libraries...</Progress>;

    case 'error':
      return (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>Could not load the project settings: {preload.error?.message}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => preload.reloadSettings()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'preloaded':
      return (
        <p className="text-muted-foreground text-sm">
          Postgres loads <InlineCode>{library}</InlineCode> at startup.
        </p>
      );

    case 'not-configured':
      return (
        <>
          <p className="text-muted-foreground text-sm">
            This adds <InlineCode>{library}</InlineCode> to the preloaded
            libraries in your project settings
            {isPlatform
              ? ' and restarts Postgres, which causes a short downtime.'
              : '.'}
          </p>
          {addError && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-wrap break-words">
                {addError}
              </AlertDescription>
            </Alert>
          )}
          <div>
            <ButtonWithLoading
              size="sm"
              onClick={handleAdd}
              loading={preload.isAdding}
              data-testid="add-preload-library"
            >
              Add to preloaded libraries
            </ButtonWithLoading>
          </div>
        </>
      );

    case 'restarting':
      return (
        <div className="space-y-1">
          <Progress>{`Restarting Postgres to load ${library}...`}</Progress>
          <p className="text-muted-foreground text-sm">
            This can take a few minutes.
          </p>
        </div>
      );

    case 'restart-failed':
      return (
        <Alert variant="destructive">
          <AlertTitle>Postgres did not restart</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Deploying the new project settings failed, so Postgres has not
              loaded <InlineCode>{library}</InlineCode>. Review your project's
              configuration and{' '}
              <TextLink href={`/orgs/${orgSlug}/projects/${appSubdomain}/logs`}>
                logs
              </TextLink>{' '}
              for more information.
            </p>
            {preload.restartError && (
              <p className="whitespace-pre-wrap break-words font-mono text-xs">
                {preload.restartError}
              </p>
            )}
          </AlertDescription>
        </Alert>
      );

    case 'pending-local-restart':
      return (
        <>
          <p className="text-muted-foreground text-sm">
            Added <InlineCode>{library}</InlineCode> to{' '}
            <InlineCode>nhost.toml</InlineCode>. Run this command with the CLI
            to restart Postgres and apply your changes:
          </p>
          <div className="flex items-center justify-between rounded-md border bg-muted px-3 py-2 font-mono text-sm">
            <span>$ nhost up</span>
            <CopyToClipboardButton
              textToCopy="nhost up"
              title="Command"
              aria-label="Copy command"
            />
          </div>
          {hasCheckedAgain && !preload.isChecking && (
            <p className="text-muted-foreground text-sm">
              Postgres has not loaded <InlineCode>{library}</InlineCode> yet.
              Make sure <InlineCode>nhost up</InlineCode> finished, then check
              again.
            </p>
          )}
          <div>
            <ButtonWithLoading
              size="sm"
              variant="outline"
              onClick={handleCheckAgain}
              loading={preload.isChecking}
            >
              Check again
            </ButtonWithLoading>
          </div>
        </>
      );
  }
}
