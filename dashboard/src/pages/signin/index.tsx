import Form from '@/components/common/Form';
import NavLink from '@/components/common/NavLink';
import GithubIcon from '@/components/icons/GithubIcon';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Input, { inputClasses } from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { useSignInEmailPassword } from '@nhost/nextjs';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
  password: Yup.string().label('Password').required(),
});

export type SignInFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function SignInPage() {
  const { signInEmailPassword, error } = useSignInEmailPassword();
  const [loading, setLoading] = useState(false);

  const form = useForm<SignInFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState } = form;

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error(
      error?.message || 'An error occurred while signing in. Please try again.',
      getToastStyleProps(),
    );
  }, [error]);

  async function handleSubmit({ email, password }: SignInFormValues) {
    try {
      await signInEmailPassword(email, password);
    } catch {
      toast.error(
        'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-4.5xl font-semibold"
      >
        Sign In with Email
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 bg-transparent"
          >
            <StyledInput
              {...register('email')}
              type="email"
              id="email"
              label="Email"
              placeholder="Email"
              autoFocus
              fullWidth
              inputProps={{ min: 2, max: 128 }}
              spellCheck="false"
              autoCapitalize="none"
              error={!!formState.errors.email}
              helperText={formState.errors.email?.message}
            />

            <StyledInput
              {...register('password')}
              type="password"
              id="password"
              label="Password"
              placeholder="Password"
              fullWidth
              inputProps={{ min: 2, max: 128 }}
              spellCheck="false"
              autoCapitalize="none"
              error={!!formState.errors.password}
              helperText={formState.errors.password?.message}
            />

            <NavLink href="/reset-password" color="secondary">
              Forgot password?
            </NavLink>

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Sign In
            </Button>

            <Button
              variant="borderless"
              className="!text-white hover:!bg-white hover:!bg-opacity-10 focus:!bg-white focus:!bg-opacity-10"
              startIcon={<GithubIcon />}
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
          </Form>
        </FormProvider>

        <Divider />

        <Text color="secondary" className="text-center text-sm">
          By clicking continue, you agree to our{' '}
          <NavLink
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Terms of Service
          </NavLink>{' '}
          and{' '}
          <NavLink
            href="https://nhost.io/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            color="white"
          >
            Privacy Policy
          </NavLink>
        </Text>
      </Box>

      <Text color="secondary" className="text-center text-lg">
        New to Nhost?{' '}
        <NavLink href="/signup" color="white" className="font-medium">
          Sign up
        </NavLink>
      </Text>
    </>
  );
}

SignInPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign In">{page}</UnauthenticatedLayout>;
};
