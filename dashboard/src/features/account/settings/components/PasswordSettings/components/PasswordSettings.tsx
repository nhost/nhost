import { FormInput } from '@/components/form/FormInput';
import { Button } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import useChangePasswordForm from '@/features/account/settings/components/PasswordSettings/hooks/useChangePasswordForm';
import useOnChangePasswordHandler from '@/features/account/settings/components/PasswordSettings/hooks/useOnChangePasswordHandler';

export default function PasswordSettings() {
  const form = useChangePasswordForm();
  const onSubmit = useOnChangePasswordHandler({
    onSuccess: () => form.reset(),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="rounded-lg border border-[#EAEDF0] bg-white font-['Inter_var'] dark:border-[#2F363D] dark:bg-paper">
          <div className="flex w-full flex-col items-start gap-4 p-4">
            <div className="flex w-full flex-col items-start">
              <h3 className="font-semibold text-[1.125rem] leading-[1.75]">
                Change Password
              </h3>
              <p className="text-[#556378] dark:text-[#A2B3BE]">
                Update your account password.
              </p>
            </div>
            <div className="flex w-[370px] flex-col gap-4">
              <FormInput
                control={form.control}
                name="newPassword"
                type="password"
                label="New Password"
              />
              <FormInput
                control={form.control}
                name="confirmPassword"
                type="password"
                label="Confirm Password"
              />
            </div>
          </div>
          <div className="flex w-full items-center justify-end border-[#EAEDF0] border-t px-4 py-2 dark:border-[#2F363D]">
            <Button type="submit" variant="outline">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
