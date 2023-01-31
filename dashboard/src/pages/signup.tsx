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
import { useSignUpEmailPassword } from '@nhost/nextjs';
import kebabCase from 'just-kebab-case';
import Image from 'next/image';
import NavLink from 'next/link';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

const sellingPoints = [
  'Awesome Free Plan',
  'Postgres Database',
  'Instant GraphQL API with Hasura',
  'Authentication and Storage',
  'TypeScript Client',
  'Serverless Functions',
  'Push code to deploy with our GitHub Integration',
];

const companies = [
  'Revtron',
  'HyperLab',
  'Orthopy',
  'Celsia',
  'ServeHub',
  'Teamtailor',
];

function SignUpWithGithub({ setSignUpMethod }: any) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        className="flex flex-row items-center space-x-6 rounded-sm+ bg-github px-6 py-3 font-display font-medium text-white transition-all duration-200 ease-in-out disabled:opacity-40"
        disabled={isLoading}
        onClick={() => {
          setIsLoading(true);
          nhost.auth.signIn({ provider: 'github' });
        }}
      >
        <GithubIcon className="h-6 w-6 text-white" />
        <div>Sign Up with GitHub</div>
      </button>
      <div className="mt-2 grid grid-flow-col items-center justify-center gap-px">
        <span>or</span>
        <Button
          variant="borderless"
          type="button"
          size="small"
          onClick={() => setSignUpMethod('email')}
          className="hover:bg-transparent hover:underline"
        >
          sign up with email
        </Button>
      </div>
    </div>
  );
}

type SignUpFormProps = {
  displayName: string;
  email: string;
  password: string;
};

function SignUpWithEmail({ setSignUpMethod }: any) {
  const { signUpEmailPassword, isLoading, isSuccess, isError, error } =
    useSignUpEmailPassword();

  const form = useForm<SignUpFormProps>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
  });

  const { register } = form;

  const router = useRouter();

  async function onSubmit({ email, password, displayName }: SignUpFormProps) {
    await signUpEmailPassword(email, password, {
      displayName,
    });
  }

  if (isSuccess) {
    router.push('/');
  }

  return (
    <div className="grid grid-flow-row items-center justify-items-center gap-2">
      <Text variant="h1" className="text-lg font-semibold">
        Sign Up with Email
      </Text>

      <FormProvider register={register} {...form}>
        <Form onSubmit={onSubmit} className="grid w-full grid-flow-row gap-3">
          <Input
            {...register('displayName')}
            id="displayName"
            placeholder="Name"
            required
            inputProps={{
              min: 2,
              max: 128,
            }}
            spellCheck="false"
            autoCapitalize="none"
            type="text"
            autoFocus
            label="Name"
            hideEmptyHelperText
            fullWidth
            autoComplete="off"
          />

          <Input
            {...register('email')}
            id="email"
            placeholder="Email"
            required
            inputProps={{
              min: 2,
              max: 128,
            }}
            spellCheck="false"
            autoCapitalize="none"
            type="email"
            label="Email"
            hideEmptyHelperText
            fullWidth
          />

          <Input
            {...register('password')}
            id="password"
            placeholder="Password"
            required
            inputProps={{
              min: 2,
              max: 128,
            }}
            spellCheck="false"
            autoCapitalize="none"
            type="password"
            label="Password"
            hideEmptyHelperText
            fullWidth
          />

          <div className="flex flex-col">
            <Button type="submit" disabled={isLoading} loading={isLoading}>
              Sign Up
            </Button>
          </div>
        </Form>
      </FormProvider>

      {isError && (
        <Text className="font-medium" color="error">
          Error: {error.message}
        </Text>
      )}

      <div className="mt-2 grid grid-flow-col items-center justify-center gap-px">
        <span>or</span>
        <Button
          variant="borderless"
          type="button"
          size="small"
          onClick={() => setSignUpMethod('github')}
          className="hover:bg-transparent hover:underline"
        >
          sign up with GitHub
        </Button>
      </div>
    </div>
  );
}

function SignUpController() {
  const [signUpMethod, setSignUpMethod] = useState('github');

  if (signUpMethod === 'github') {
    return <SignUpWithGithub setSignUpMethod={setSignUpMethod} />;
  }
  if (signUpMethod === 'email') {
    return <SignUpWithEmail setSignUpMethod={setSignUpMethod} />;
  }

  return null;
}

export default function SignUpPage() {
  const theme = useTheme();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="grid max-w-6xl grid-cols-1 gap-x-20 gap-y-14 px-5 md:grid-cols-2">
        <div className="flex items-center justify-center md:order-1">
          <div className="z-30">
            <div className="block md:hidden">
              <div className="mb-5">
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
              </div>
              <div className="mb-4 text-3xl font-semibold">
                Build the App of Your Dreams
              </div>
            </div>
            <Box className="rounded-lg border px-12 py-4">
              <div className="my-4">
                <SignUpController />
              </div>
              <Text className="mt-4 text-center text-xs" color="secondary">
                By signing up, you agree to our{' '}
                <Link
                  href="https://nhost.io/legal/terms-of-service"
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="https://nhost.io/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                >
                  Privacy Policy
                </Link>
                .
              </Text>
            </Box>
            <div className="mt-3 flex justify-center">
              <div className="grid grid-flow-col items-center justify-center gap-1">
                <Text className="text-sm">Already have an account?</Text>

                <NavLink href="/signin" passHref>
                  <Link href="signin" underline="hover">
                    Sign in
                  </Link>
                </NavLink>
              </div>
            </div>
          </div>
          <div className="absolute w-full max-w-[887px]">
            <Image
              src="/assets/signup/bg-gradient.svg"
              alt="Gradient background"
              width={887}
              height={620}
              layout="responsive"
            />
          </div>
        </div>
        <div className="">
          <div className="hidden md:block">
            <div className="mb-10">
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
            </div>
            <div className="mb-4 text-2xl font-semibold">
              Build the App of Your Dreams
            </div>
          </div>
          <div className="my-4 flex flex-col space-y-3">
            {sellingPoints.map((sellingPoint) => (
              <div key={sellingPoint} className="flex items-center space-x-2">
                <Image
                  src="/assets/signup/CircleWavyCheck.svg"
                  alt="Check"
                  width={24}
                  height={24}
                />

                <Text className="!text-xl" color="secondary">
                  {sellingPoint}
                </Text>
              </div>
            ))}
          </div>
          <Box
            className="my-14 h-2 opacity-20"
            sx={{ backgroundColor: 'primary.main' }}
          />
          <div className="my-4 grid grid-cols-3 items-center gap-x-6 gap-y-6 opacity-40">
            {companies.map((company) => (
              <div key={company} className="h-[25px] w-[150px]">
                <Image
                  src={
                    theme.palette.mode === 'dark'
                      ? `/assets/brands/light/${kebabCase(company)}.svg`
                      : `/assets/brands/${kebabCase(company)}.svg`
                  }
                  alt={`Logo of ${company}`}
                  width={150}
                  height={25}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};
