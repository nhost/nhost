import Form from '@/components/common/Form';
import GithubIcon from '@/components/icons/GithubIcon';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { useTheme } from '@mui/material';
import { useSignInEmailPassword } from '@nhost/nextjs';
import Image from 'next/image';
import NavLink from 'next/link';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

function SignInWithGithub({ setSignInMethod }: any) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        className="flex flex-row items-center space-x-4 rounded-sm+ bg-github px-6 py-3 font-display font-medium text-white transition-all duration-200 ease-in-out disabled:opacity-40"
        disabled={isLoading}
        onClick={() => {
          setIsLoading(true);
          nhost.auth.signIn({ provider: 'github' });
        }}
      >
        <GithubIcon className="h-6 w-6" />
        <div>Continue with GitHub</div>
      </button>
      <div className="mt-2 grid grid-flow-col items-center justify-center gap-px">
        <span>or</span>
        <Button
          variant="borderless"
          type="button"
          size="small"
          onClick={() => setSignInMethod('email')}
          className="hover:bg-transparent hover:underline"
        >
          sign in with email
        </Button>
      </div>
    </div>
  );
}

type SignInFormProps = {
  email: string;
  password: string;
};

function SignInWithEmail({ setSignInMethod }: any) {
  const { signInEmailPassword, isLoading, isSuccess, isError, error } =
    useSignInEmailPassword();

  const form = useForm<SignInFormProps>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
  });
  const { register } = form;

  const router = useRouter();

  async function onSubmit({ email, password }: SignInFormProps) {
    await signInEmailPassword(email, password);
  }

  if (isSuccess) {
    router.push('/');
  }

  return (
    <Box className="flex max-w-2xl flex-col items-center">
      <FormProvider register={register} {...form}>
        <Form onSubmit={onSubmit} className="grid w-full grid-flow-row gap-3">
          <Input
            {...register('email')}
            autoFocus
            id="email"
            label="Email"
            placeholder="Email"
            required
            fullWidth
            inputProps={{
              min: 2,
              max: 128,
            }}
            spellCheck="false"
            autoCapitalize="none"
            type="email"
            hideEmptyHelperText
          />

          <Input
            {...register('password')}
            id="password"
            placeholder="Password"
            required
            fullWidth
            label={
              <span className="grid grid-flow-col justify-between">
                <span>Password</span>

                <NavLink href="/reset-password" passHref>
                  <Link
                    href="reset-password"
                    tabIndex={-1}
                    className="text-xs"
                    underline="hover"
                  >
                    Forgot your password?
                  </Link>
                </NavLink>
              </span>
            }
            inputProps={{ min: 2, max: 128 }}
            spellCheck="false"
            autoCapitalize="none"
            type="password"
            hideEmptyHelperText
          />

          <div className="flex flex-col">
            <Button type="submit" disabled={isLoading} loading={isLoading}>
              Sign In
            </Button>
          </div>
        </Form>
      </FormProvider>

      {isError && (
        <Text className="my-3 font-medium" color="error">
          Error: {error.message}
        </Text>
      )}

      <div className="mt-2 grid grid-flow-col items-center justify-center gap-px">
        <span>or</span>
        <Button
          variant="borderless"
          type="button"
          size="small"
          onClick={() => setSignInMethod('github')}
          className="hover:bg-transparent hover:underline"
        >
          sign in with GitHub
        </Button>
      </div>
    </Box>
  );
}

function SignInController() {
  const [signInMethod, setSignInMethod] = useState('github');

  if (signInMethod === 'github') {
    return <SignInWithGithub setSignInMethod={setSignInMethod} />;
  }

  if (signInMethod === 'email') {
    return <SignInWithEmail setSignInMethod={setSignInMethod} />;
  }

  return null;
}

export default function SignInPage() {
  const theme = useTheme();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex max-w-3xl flex-col">
        <div className="z-30 mb-8 flex justify-center">
          <a href="https://nhost.io" tabIndex={-1}>
            <Image
              src={
                theme.palette.mode === 'dark'
                  ? '/assets/brands/light/nhost-with-text.svg'
                  : '/assets/brands/nhost-with-text.svg'
              }
              alt="Nhost Logo"
              width={185}
              height={64}
            />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <div className="z-10">
            <Box
              className="grid grid-flow-row gap-4 rounded-lg border px-12 py-8"
              style={{ width: '480px' }}
            >
              <Text variant="h1" className="text-center text-lg font-semibold">
                Sign in to Nhost
              </Text>

              <SignInController />
            </Box>

            <div className="mt-3 flex justify-center">
              <div className="grid grid-flow-col items-center justify-center gap-1">
                <Text className="text-sm">Don&apos;t have an account?</Text>

                <NavLink href="/signup" passHref>
                  <Link href="signup" underline="hover">
                    Sign up
                  </Link>
                </NavLink>
              </div>
            </div>
          </div>

          <div className="absolute z-0 w-full max-w-[887px]">
            <Image
              src="/assets/signup/bg-gradient.svg"
              alt="Gradient background"
              width={887}
              height={620}
              layout="responsive"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

SignInPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign In">{page}</UnauthenticatedLayout>;
};
