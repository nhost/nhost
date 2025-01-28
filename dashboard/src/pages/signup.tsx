import { NavLink } from '@/components/common/NavLink';
import { Form } from '@/components/form/Form';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';
import { yupResolver } from '@hookform/resolvers/yup';
import { Turnstile } from '@marsidev/react-turnstile';
import { styled } from '@mui/material';
import { useSignUpEmailPassword } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
  password: Yup.string().label('Password').required(),
  displayName: Yup.string().label('Name').required(),
});

export type SignUpFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function SignUpPage() {
  const { signUpEmailPassword, error } = useSignUpEmailPassword();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // x-cf-turnstile-response
  const [turnstileResponse, setTurnstileResponse] = useState(null);

  const form = useForm<SignUpFormValues>({
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
      error?.message || 'An error occurred while signing up. Please try again.',
      getToastStyleProps(),
    );
  }, [error]);

  async function handleSubmit({
    email,
    password,
    displayName,
  }: SignUpFormValues) {
    if (!turnstileResponse) {
      toast.error(
        'Please complete the signup verification challenge to continue.',
        getToastStyleProps(),
      );

      return;
    }

    try {
      const { needsEmailVerification } = await signUpEmailPassword(
        email,
        password,
        {
          displayName,
        },
        {
          headers: {
            'x-cf-turnstile-response': turnstileResponse,
          },
        },
      );

      if (needsEmailVerification) {
        router.push(`/email/verify?email=${email}`);
      }
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
        className="text-center text-3.5xl font-semibold lg:text-4.5xl"
      >
        Sign Up
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <Button
          variant="borderless"
          className="!bg-white !text-black hover:ring-2 hover:ring-white hover:ring-opacity-50 disabled:!text-black disabled:!text-opacity-60"
          startIcon={<GitHubIcon />}
          disabled={loading}
          loading={loading}
          size="large"
          onClick={async () => {
            setLoading(true);

            try {
              await nhost.auth.signIn({ provider: 'github' });
            } catch {
              toast.error(
                `An error occurred while trying to sign up using GitHub. Please try again.`,
                getToastStyleProps(),
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          Sign Up with GitHub
        </Button>

        <div className="relative py-2">
          <Text
            className="absolute left-0 right-0 top-1/2 mx-auto w-12 -translate-y-1/2 bg-black px-2 text-center text-sm"
            color="disabled"
          >
            OR
          </Text>

          <Divider />
        </div>

        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 bg-transparent"
          >
            <StyledInput
              {...register('displayName')}
              id="displayName"
              label="Name"
              placeholder="Name"
              fullWidth
              autoFocus
              inputProps={{ min: 2, max: 128 }}
              error={!!formState.errors.email}
              helperText={formState.errors.email?.message}
            />

            <StyledInput
              {...register('email')}
              type="email"
              id="email"
              label="Email"
              placeholder="Email"
              fullWidth
              inputProps={{ min: 2, max: 128 }}
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
              error={!!formState.errors.password}
              helperText={formState.errors.password?.message}
            />

            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              options={{ theme: 'dark', size: 'flexible' }}
              onSuccess={setTurnstileResponse}
            />

            <Button
              variant="outlined"
              color="secondary"
              className="hover:!bg-white hover:!bg-opacity-10 focus:ring-0"
              size="large"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Sign Up
            </Button>
          </Form>
        </FormProvider>

        <Divider className="!my-2" />

        <Text color="secondary" className="text-center text-sm">
          By signing up, you agree to our{' '}
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

      <Text color="secondary" className="text-center text-base lg:text-lg">
        Already have an account?{' '}
        <NavLink href="/signin" color="white" className="font-medium">
          Sign In
        </NavLink>
      </Text>
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};
