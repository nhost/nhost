import { FormInput } from '@/components/form/FormInput';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import useSignupWithSecurityKeyForm from '@/features/auth/SignUp/SignUpTabs/SignUpWithSecurityKey/hooks/useSignupWithSecurityKeyForm';
import useSignupWithSecurityKeyHandler from '@/features/auth/SignUp/SignUpTabs/SignUpWithSecurityKey/hooks/useSignupWithSecurityKeyHandler';
import { Turnstile } from '@marsidev/react-turnstile';

function SignUpWithSecurityKeyForm() {
  const form = useSignupWithSecurityKeyForm();
  const onSignUpWithSecurityKey = useSignupWithSecurityKeyHandler();

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSignUpWithSecurityKey)}
        className="grid grid-flow-row gap-4 bg-transparent"
      >
        <FormInput control={form.control} label="Name" name="displayName" />
        <FormInput
          control={form.control}
          label="Email"
          name="email"
          type="email"
        />
        <FormField
          control={form.control}
          name="turnstileToken"
          render={() => (
            <FormItem>
              <FormLabel>Verification</FormLabel>
              <FormControl>
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                  options={{ theme: 'dark', size: 'flexible' }}
                  onSuccess={(token) => {
                    form.setValue('turnstileToken', token, {
                      shouldValidate: true,
                    });
                  }}
                  onError={() => {
                    form.setValue('turnstileToken', '', {
                      shouldValidate: true,
                    });
                  }}
                  onExpire={() => {
                    form.setValue('turnstileToken', '', {
                      shouldValidate: true,
                    });
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="outline"
          className="w-full !bg-transparent"
        >
          Sign Up
        </Button>
      </form>
    </Form>
  );
}

export default SignUpWithSecurityKeyForm;
