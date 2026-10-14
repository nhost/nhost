import { SiGithub } from '@icons-pack/react-simple-icons';
import NextLink from 'next/link';
import { FormInput } from '@/components/form/FormInput';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { TextLink } from '@/components/ui/v3/text-link';
import useSignInWithEmailAndPasswordForm, {
  type SignInWithEmailAndPasswordFormValues,
} from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useSignInWithEmailAndPasswordForm';

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
          placeholder="Email"
        />
        <FormInput
          control={form.control}
          label="Password"
          name="password"
          type="password"
          placeholder="Password"
        />
        <TextLink
          href="/password/new"
          className="justify-self-start font-semibold"
        >
          Forgot password?
        </TextLink>
        <ButtonWithLoading
          type="submit"
          className="w-full"
          disabled={isLoading}
          loading={isLoading}
        >
          Sign In
        </ButtonWithLoading>
        <Button variant="outline-emboss" className="gap-2 text-sm+" asChild>
          <NextLink href="/signin">
            <SiGithub size={14} />
            Sign in with GitHub
          </NextLink>
        </Button>
      </form>
    </Form>
  );
}

export default SignInWithEmailAndPassword;
