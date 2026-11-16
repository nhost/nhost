import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
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

  async function handleSubmit(formValues: EmailSettingFormValues) {
    await changeEmail(formValues.email);
  }

  return (
    <Form {...form}>
      <AccountSettingsCard asChild>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <SettingsCardHeader title="Update your email" />

          <SettingsCardContent className="lg:grid-cols-5">
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              spellCheck={false}
              autoCapitalize="none"
              containerClassName="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </form>
      </AccountSettingsCard>
    </Form>
  );
}
