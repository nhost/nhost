import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { useState } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Label } from '@/components/ui/v3/label';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import execPromiseWithErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/execPromiseWithErrorToast';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import {
  useDeleteAuthUserProviderMutation,
  useGetAuthUserProvidersQuery,
} from '@/utils/__generated__/graphql';

function ConfirmDisconnectGithubModal({
  close,
  onDisconnect,
}: {
  close: () => void;
  onDisconnect: () => Promise<unknown>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onClickConfirm() {
    setLoading(true);

    await execPromiseWithErrorToast(
      async () => {
        await onDisconnect();
        close();
      },
      {
        loadingMessage: 'Disconnecting GitHub account...',
        successMessage: 'GitHub account has been disconnected successfully.',
        errorMessage:
          'An error occurred while disconnecting your GitHub account. Please try again.',
      },
    );

    setLoading(false);
  }

  return (
    <div className="text-foreground">
      <DialogHeader>
        <DialogTitle>Disconnect GitHub</DialogTitle>
      </DialogHeader>
      <DialogDescription className="mt-2 text-muted-foreground text-sm">
        You can connect a different GitHub account afterwards. If you use GitHub
        to sign in, make sure you still have another way to access your account.
      </DialogDescription>

      <div className="mt-4 flex items-center gap-2">
        <Checkbox
          id="confirm-disconnect-github"
          checked={confirm}
          onCheckedChange={(checked) => setConfirm(checked === true)}
          aria-label="Confirm disconnect GitHub"
        />
        <Label htmlFor="confirm-disconnect-github">
          I&apos;m sure I want to disconnect GitHub from my account
        </Label>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <ButtonWithLoading
          variant="destructive"
          onClick={onClickConfirm}
          loading={loading}
          disabled={!confirm}
        >
          Disconnect
        </ButtonWithLoading>
      </div>
    </div>
  );
}

export default function SocialProvidersSettings() {
  const nhost = useNhostClient();
  const {
    data,
    loading: loadingAuthUserProviders,
    error,
    refetch: refetchAuthUserProviders,
  } = useGetAuthUserProvidersQuery();
  const githubUserProvider = data?.authUserProviders?.find(
    (item) => item.providerId === 'github',
  );
  const isGithubConnected = isNotEmptyValue(githubUserProvider);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const [deleteGitHubUserProvider, { loading: deletingGitHubUserProvider }] =
    useDeleteAuthUserProviderMutation();

  async function handleDisconnectGithub() {
    if (isEmptyValue(githubUserProvider?.id)) {
      throw new Error('GitHub provider id not found');
    }

    await deleteGitHubUserProvider({
      variables: { id: githubUserProvider!.id },
    });
    await refetchAuthUserProviders();
  }

  // Linking is an authenticated, elevated action: the access token goes in the
  // Authorization header (never the URL), and the auth server records the user
  // in a single-use cookie. The callback links the provider to that user, then
  // redirects back here. useActionWithElevatedPermissions steps the session up
  // first when the user has security keys.
  const connectGithub = useActionWithElevatedPermissions({
    actionFn: async () => {
      // `credentials: 'include'` is required: the auth server sets the
      // single-use link cookie on this response, and the browser only stores a
      // cross-origin Set-Cookie when the request is credentialed. Without it the
      // provider callback finds no cookie and linking fails with invalid-request.
      const response = await nhost.auth.linkProvider(
        'github',
        {
          redirectTo: `${window.location.origin}/account?signinProvider=github`,
        },
        { credentials: 'include' },
      );
      window.location.href = response.body.url;
    },
    successMessage: 'Redirecting to GitHub…',
  });

  if (!data && loadingAuthUserProviders) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading authentication providers..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <div className="rounded-lg border border-[#EAEDF0] bg-white font-['Inter_var'] dark:border-[#2F363D] dark:bg-paper">
      <div className="flex flex-col gap-2 px-4 py-4">
        <h3 className="flex items-center font-semibold text-[1.125rem] leading-[1.75]">
          Authentication providers
        </h3>
        {isGithubConnected ? (
          <div className="flex w-fit flex-row items-center justify-start gap-2 rounded-md bg-[#f4f7f9] p-2 dark:bg-[#21262c]">
            <GitHubIcon />
            <span className="font-medium">Connected</span>
          </div>
        ) : (
          <Button
            variant="outline"
            className="flex w-fit flex-row gap-2 bg-white text-sm+ hover:bg-[#e2e8ef] dark:bg-[#171d26] dark:hover:bg-[#2f363e]"
            onClick={() => connectGithub()}
          >
            <GitHubIcon />
            Connect with GitHub
          </Button>
        )}
      </div>

      {isGithubConnected && (
        <div className="flex w-full items-center border-[#EAEDF0] border-t px-4 py-2 dark:border-[#2F363D]">
          <Dialog
            open={disconnectDialogOpen}
            onOpenChange={setDisconnectDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-9 gap-2 border-destructive p-y[0.375rem] px-2 text-destructive hover:bg-destructive hover:text-white"
                disabled={deletingGitHubUserProvider}
              >
                Disconnect GitHub
              </Button>
            </DialogTrigger>
            <DialogContent className="z-[9999] max-w-[28rem] text-foreground">
              <ConfirmDisconnectGithubModal
                close={() => setDisconnectDialogOpen(false)}
                onDisconnect={handleDisconnectGithub}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
