import { FormInput } from '@/components/form/FormInput';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import useSignInWithEmailAndPasswordForm, {
  type SignInWithEmailAndPasswordFormValues,
} from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useSignInWithEmailAndPasswordForm';
import NextLink from 'next/link';

interface Props {
  onSubmit: (values: SignInWithEmailAndPasswordFormValues) => void;
  isLoading: boolean;
}

function SignInWithEmailAndPassword({ onSubmit, isLoading }: Props) {
  const form = useSignInWithEmailAndPasswordForm();
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-flow-row gap-4 bg-transparent"
      >
        <FormInput
          control={form.control}
          label="Email"
          name="email"
          type="email"
        />
        <FormInput
          control={form.control}
          label="Password"
          name="password"
          type="password"
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
          disabled={isLoading}
          loading={isLoading}
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
