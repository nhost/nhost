import { FormPasswordInput } from '@/components/form/FormPasswordInput';
import {
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import useChangePasswordForm from '@/features/account/settings/components/PasswordSettings/hooks/useChangePasswordForm';
import useOnChangePasswordHandler from '@/features/account/settings/components/PasswordSettings/hooks/useOnChangePasswordHandler';

export default function PasswordSettings() {
  const form = useChangePasswordForm();
  const onSubmit = useOnChangePasswordHandler({
    onSuccess: () => form.reset(),
  });

  return (
    <Form {...form}>
      <AccountSettingsCard asChild>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsCardHeader title="Password" />

          {/* Same shape as the organization settings form: the fields
              share the full width, Save sits in the footer. */}
          <SettingsCardContent className="sm:grid-cols-2">
            <FormPasswordInput
              control={form.control}
              name="newPassword"
              label="New password"
            />
            <FormPasswordInput
              control={form.control}
              name="confirmPassword"
              label="Confirm password"
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
