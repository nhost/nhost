import Form from '@/components/common/Form';
import GithubIcon from '@/components/icons/GithubIcon';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { useSignInEmailPassword } from '@nhost/nextjs';
import Image from 'next/image';
import Link from 'next/link';
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
        <GithubIcon className="h-6 w-6 text-white " />
        <div>Continue with GitHub</div>
      </button>
      <div className="mt-2 text-greyscaleMedium">
        or{' '}
        <button
          type="button"
          onClick={() => setSignInMethod('email')}
          className="cursor-pointer text-btn hover:underline"
        >
          sign in with email
        </button>
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
    <div className="flex max-w-2xl flex-col items-center">
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

                <Link href="/reset-password" passHref>
                  <a
                    href="reset-password"
                    tabIndex={-1}
                    className="text-xs text-btn hover:underline"
                  >
                    Forgot your password?
                  </a>
                </Link>
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
        <Text className="my-3 font-medium text-red">
          Error: {error.message}
        </Text>
      )}

      <div className="mt-2 text-greyscaleMedium">
        or{' '}
        <button
          type="button"
          onClick={() => setSignInMethod('github')}
          className="cursor-pointer text-btn hover:underline"
        >
          sign in with GitHub
        </button>
      </div>
    </div>
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
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex max-w-3xl flex-col">
        <div className="z-30 mb-8 flex justify-center">
          <a href="https://nhost.io" tabIndex={-1}>
            <Image
              src="/assets/Logo.svg"
              alt="Nhost Logo"
              width={185}
              height={64}
            />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <div className="z-10">
            <div
              className="grid grid-flow-row gap-4 rounded-lg border border-gray-300 bg-white px-12 py-8"
              style={{ width: '480px' }}
            >
              <Text variant="h1" className="text-center text-lg font-semibold">
                Sign in to Nhost
              </Text>

              <SignInController />
            </div>

            <div className="mt-3 flex justify-center">
              <div className="text-sm text-gray-700">
                Don&apos;t have an account?{' '}
                <Link href="/signup" passHref>
                  <a className="text-btn hover:underline" href="signup">
                    Sign up
                  </a>
                </Link>
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
