import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { useState } from 'react';
import {
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
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
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useDeleteAuthUserProviderMutation,
  useGetAuthUserProvidersQuery,
} from '@/generated/graphql';
import { useAccessToken } from '@/hooks/useAccessToken';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';

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
  const token = useAccessToken();
  const {
    data,
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
    const githubUserProviderId = githubUserProvider?.id;

    if (isEmptyValue(githubUserProviderId)) {
      throw new Error('GitHub provider id not found');
    }

    await deleteGitHubUserProvider({
      variables: { id: githubUserProviderId },
    });
    await refetchAuthUserProviders();
  }

  async function handleConnectGithub() {
    const { challenge, id } = await generateAndStorePKCE();
    const url = nhost.auth.signInProviderURL('github', {
      connect: token,
      redirectTo: appendPkceId(
        `${window.location.origin}/account?signinProvider=github`,
        id,
      ),
      codeChallenge: challenge,
    });
    window.location.href = url;
  }

  if (error) {
    throw error;
  }

  return (
    <AccountSettingsCard>
      <SettingsCardHeader title="Authentication providers" />

      <SettingsCardContent>
        {isGithubConnected ? (
          <div className="flex w-fit flex-row items-center justify-start gap-2 rounded-md bg-[#f4f7f9] p-2 dark:bg-[#21262c]">
            <GitHubIcon />
            <span className="font-medium">Connected</span>
          </div>
        ) : (
          <Button
            variant="outline"
            className="flex w-fit flex-row gap-2 bg-white text-sm+ hover:bg-[#e2e8ef] dark:bg-[#171d26] dark:hover:bg-[#2f363e]"
            onClick={handleConnectGithub}
          >
            <GitHubIcon />
            Connect with GitHub
          </Button>
        )}
      </SettingsCardContent>

      {isGithubConnected && (
        <SettingsCardFooter className="justify-start sm:justify-start">
          <Dialog
            open={disconnectDialogOpen}
            onOpenChange={setDisconnectDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-9 gap-2 border-destructive px-2 text-destructive hover:bg-destructive hover:text-white"
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
        </SettingsCardFooter>
      )}
    </AccountSettingsCard>
  );
}
