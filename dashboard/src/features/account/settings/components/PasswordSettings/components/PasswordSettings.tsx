import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
// import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import useChangePasswordForm from '@/features/account/settings/components/PasswordSettings/hooks/useChangePasswordForm';
import useOnChangePasswordHandler from '@/features/account/settings/components/PasswordSettings/hooks/useOnChangePasswordHandler';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 dark:aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500 dark:border-[#2F363D] border-[#EAEDF0]';

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
              <h3 className="text-[1.125rem] font-semibold leading-[1.75]">
                Change Password
              </h3>
              <p className="text-[#556378] dark:text-[#A2B3BE]">
                Update your account password.
              </p>
            </div>
            <div className="flex w-[370px] flex-col gap-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px]">New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        className={inputClasses}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px]">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        className={inputClasses}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex w-full items-center justify-end border-t border-[#EAEDF0] px-4 py-2 dark:border-[#2F363D]">
            <Button type="submit" variant="outline">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
