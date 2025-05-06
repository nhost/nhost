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
import { Turnstile } from '@marsidev/react-turnstile';
import useSignupWithSecurityKeyForm from './useSignupWithSecurityKeyForm';
import useSignupWithSecurityKeyHandler from './useSignupWithSecurityKeyHandler';

function SignUpWithEmailAndPasswordForm() {
  const form = useSignupWithSecurityKeyForm();
  const onSignUpWithSecurityKey = useSignupWithSecurityKeyHandler();

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSignUpWithSecurityKey)}
        className="grid grid-flow-row gap-4 bg-transparent"
      >
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Name"
                  {...field}
                  className="!bg-transparent"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="Email"
                  type="email"
                  {...field}
                  className="!bg-transparent"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="turnstileToken"
          render={() => (
            <FormItem>
              <FormLabel>Verification</FormLabel>
              <FormControl>
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
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

export default SignUpWithEmailAndPasswordForm;
