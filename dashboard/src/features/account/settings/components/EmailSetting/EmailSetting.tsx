import { yupResolver } from '@hookform/resolvers/yup';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';
import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useUserData } from '@/hooks/useUserData';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { useNhostClient } from '@/providers/nhost';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
});

export type EmailSettingFormValues = Yup.InferType<typeof validationSchema>;

export default function EmailSetting() {
  const nhost = useNhostClient();
  const user = useUserData();
  // The new email waiting to be confirmed. Set when the form is submitted,
  // so a stray Enter only opens the dialog, it never sends the link.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const form = useForm<EmailSettingFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { email: user?.email ?? '' },
    resolver: yupResolver(validationSchema),
  });

  const changeEmail = useActionWithElevatedPermissions({
    actionFn: async (newEmail: string) => {
      const { challenge, id } = await generateAndStorePKCE();
      const result = await nhost.auth.changeUserEmail({
        newEmail,
        codeChallenge: challenge,
        options: {
          redirectTo: appendPkceId(`${window.location.origin}/account`, id),
        },
      });
      return result;
    },
    successMessage:
      'Please check your inbox. Follow the link to finalize changing your email.',
    onSuccess: () => form.reset(),
  });

  function handleSubmit(formValues: EmailSettingFormValues) {
    setPendingEmail(formValues.email);
  }

  async function handleConfirm() {
    if (!pendingEmail) {
      return;
    }

    // Close first: changing email may ask for a passkey, and that prompt
    // shouldn't open on top of this dialog.
    const newEmail = pendingEmail;
    setPendingEmail(null);
    setSending(true);

    try {
      await changeEmail(newEmail);
    } finally {
      setSending(false);
    }
  }

  return (
    <Form {...form}>
      <AccountSettingsCard asChild>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <SettingsCardHeader
            title="Email"
            control={
              <ButtonWithLoading
                type="submit"
                disabled={!form.formState.isDirty}
                loading={sending}
                className="w-full sm:w-auto"
              >
                Change email
              </ButtonWithLoading>
            }
          >
            <FormInput
              control={form.control}
              name="email"
              aria-label="Email"
              type="email"
              spellCheck={false}
              autoCapitalize="none"
              containerClassName="w-full sm:w-96"
            />
          </SettingsCardHeader>
        </form>
      </AccountSettingsCard>

      <AlertDialog
        open={pendingEmail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingEmail(null);
          }
        }}
      >
        <AlertDialogContent className="z-[9999] p-12 text-foreground">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-xl">
              Change your email?
            </AlertDialogTitle>
            <AlertDialogDescription>
              We&apos;ll send a link to the new address. Your email only changes
              when you click it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Before and after as tags, so the change reads at a glance. */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="max-w-full break-all rounded-md border bg-muted px-2.5 py-1 text-muted-foreground line-through">
              {user?.email}
            </span>
            <ArrowRight
              aria-hidden
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
            <span className="max-w-full break-all rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary">
              {pendingEmail}
            </span>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" onClick={handleConfirm}>
              Send link
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
