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
import useSignInWithEmailAndPasswordForm, {
  type SignInWithEmailAndPasswordFormValues,
} from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useSignInWithEmailAndPasswordForm';
import NextLink from 'next/link';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500 border-[#6b7280]';

interface Props {
  onSubmit: (values: SignInWithEmailAndPasswordFormValues) => void;
}

function SignInWithEmailAndPassword({ onSubmit }: Props) {
  const form = useSignInWithEmailAndPasswordForm();
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-flow-row gap-4 bg-transparent"
      >
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
                  className={inputClasses}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  placeholder="Password"
                  type="password"
                  {...field}
                  className={inputClasses}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <NextLink
          href="/password/new"
          className="justify-self-start font-semibold"
        >
          Forgot password?
        </NextLink>
        <Button
          type="submit"
          variant="outline"
          className="w-full !bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
        >
          Sign In
        </Button>
        <p color="secondary" className="text-center">
          <span className="text-[#A2B3BE]">or </span>
          <NextLink className="font-semibold" href="/signin">
            sign in with GitHub
          </NextLink>
        </p>
      </form>
    </Form>
  );
}

export default SignInWithEmailAndPassword;
