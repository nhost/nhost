import Form from '@/components/common/Form';
import GithubIcon from '@/components/icons/GithubIcon';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Input from '@/ui/v2/Input';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useSignUpEmailPassword } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

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

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-4.5xl font-semibold"
      >
        It&apos;s time to build
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-12">
        <Button
          className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
          startIcon={<GithubIcon />}
          size="large"
          disabled={loading}
          loading={loading}
          onClick={async () => {
            setLoading(true);

            try {
              await nhost.auth.signIn({ provider: 'github' });
            } catch {
              toast.error(
                `An error occurred while trying to sign in using GitHub. Please try again later.`,
                getToastStyleProps(),
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          Continue with GitHub
        </Button>

        <Button
          variant="borderless"
          className="!text-white hover:!bg-white hover:!bg-opacity-10 focus:!bg-white focus:!bg-opacity-10"
          size="large"
          href="/signup/email"
        >
          Continue with Email
        </Button>

        <Divider />

        <Text color="secondary" className="text-center text-sm">
          By clicking continue, you agree to our{' '}
          <Link
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="https://nhost.io/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Privacy Policy
          </Link>
        </Text>
      </Box>

      <Text color="secondary" className="text-center text-lg">
        Already have an account?{' '}
        <Link href="/signin" color="White">
          Sign in
        </Link>
      </Text>
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};
