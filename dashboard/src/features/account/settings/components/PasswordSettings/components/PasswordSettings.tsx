import { FormPasswordInput } from '@/components/form/FormPasswordInput';
import { SettingsCardHeader } from '@/components/layout/SettingsCard';
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
          <SettingsCardHeader
            size="lg"
            title="Password"
            className="sm:items-end"
            control={
              <ButtonWithLoading
                type="submit"
                disabled={!form.formState.isDirty}
                loading={form.formState.isSubmitting}
                className="w-full sm:w-auto"
              >
                Save
              </ButtonWithLoading>
            }
          >
            <div className="grid gap-4">
              <FormPasswordInput
                control={form.control}
                name="newPassword"
                label="New password"
                containerClassName="w-full sm:w-96"
              />
              <FormPasswordInput
                control={form.control}
                name="confirmPassword"
                label="Confirm password"
                containerClassName="w-full sm:w-96"
              />
            </div>
          </SettingsCardHeader>
        </form>
      </AccountSettingsCard>
    </Form>
  );
}
