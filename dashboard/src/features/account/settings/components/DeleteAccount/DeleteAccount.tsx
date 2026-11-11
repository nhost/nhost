import { useState } from 'react';
import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import { Alert } from '@/components/ui/v3/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteUserAccountMutation } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/providers/Auth';
import {
  errorMessageIncludes,
  getViolatedConstraint,
} from '@/utils/databaseErrors';

export default function DeleteAccount() {
  const { signout } = useAuth();
  const userData = useUserData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loadingRemove, setLoadingRemove] = useState(false);

  // Same as deleting a project or an organization: tick the box and type
  // something you have to read off the screen.
  const email = userData?.email;
  const canDelete = acknowledged && !!email && confirmation === email;

  const [deleteUserAccount] = useDeleteUserAccountMutation({
    variables: { id: userData?.id },
  });

  const onClickConfirm = async () => {
    setLoadingRemove(true);

    await execPromiseWithErrorToast(
      async () => {
        await deleteUserAccount();
        await signout();
        setDialogOpen(false);
      },
      {
        loadingMessage: 'Deleting your account...',
        successMessage: 'The account has been deleted successfully.',
        errorMessage: (error) => {
          if (getViolatedConstraint(error) === 'apps_creator_user_id_fkey') {
            return 'Your account still owns projects. Delete them before deleting your account.';
          }

          if (errorMessageIncludes(error, 'Cannot delete the last admin')) {
            return 'You are the only admin of an organization. Promote another member to admin or delete the organization before deleting your account.';
          }

          return 'An error occurred while deleting your account. Please try again.';
        },
      },
    );

    setLoadingRemove(false);
  };

  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        size="lg"
        title="Delete account"
        description="Permanently delete your account and all its data. This can't be undone."
        control={
          <AlertDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setAcknowledged(false);
                setConfirmation('');
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="z-[9999] p-12 text-foreground">
              <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="text-xl">
                  Delete account?
                </AlertDialogTitle>
              </AlertDialogHeader>

              <AlertDialogDescription asChild>
                <Alert variant="warning">
                  This action is permanent and cannot be undone.
                </Alert>
              </AlertDialogDescription>

              <div className="my-2 flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="confirm-delete-account"
                    checked={acknowledged}
                    onCheckedChange={(checked) =>
                      setAcknowledged(checked === true)
                    }
                  />
                  <Label
                    htmlFor="confirm-delete-account"
                    className="cursor-pointer font-normal text-foreground"
                  >
                    I understand this action cannot be undone
                  </Label>
                </div>

                <div className="grid gap-2">
                  <Label
                    htmlFor="delete-account-confirmation"
                    className="font-normal text-foreground"
                  >
                    Type{' '}
                    <InlineCode className="max-w-full whitespace-pre-wrap break-words bg-input text-foreground text-sm dark:bg-input">
                      {email}
                    </InlineCode>{' '}
                    to confirm
                  </Label>
                  <Input
                    id="delete-account-confirmation"
                    autoComplete="off"
                    className="border-border font-mono"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel disabled={loadingRemove}>
                  Cancel
                </AlertDialogCancel>

                <ButtonWithLoading
                  type="button"
                  variant="destructive"
                  onClick={onClickConfirm}
                  disabled={!canDelete}
                  loading={loadingRemove}
                >
                  Delete
                </ButtonWithLoading>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        }
      />
    </AccountSettingsCard>
  );
}
