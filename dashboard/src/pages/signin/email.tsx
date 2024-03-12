import { NavLink } from '@/components/common/NavLink';
import { Form } from '@/components/form/Form';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { getToastStyleProps } from '@/utils/constants/settings';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { useNhostClient, useSignInEmailPassword } from '@nhost/nextjs';
import { useEffect, useState, type ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
  password: Yup.string().label('Password').required(),
});

export type EmailSignUpFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function EmailSignUpPage() {
  const { signInEmailPassword, error } = useSignInEmailPassword();
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [resendVerificationEmailLoading, setResendVerificationEmailLoading] =
    useState(false);

  const nhost = useNhostClient();

  const form = useForm<EmailSignUpFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState, watch } = form;
  const emailFormValue = watch('email');

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error(
      error?.message || 'An error occurred while signing in. Please try again.',
      getToastStyleProps(),
    );
  }, [error]);

  async function handleSubmit({ email, password }: EmailSignUpFormValues) {
    try {
      const { needsEmailVerification } = await signInEmailPassword(
        email,
        password,
      );

      setIsEmailVerified(!needsEmailVerification);

      if (needsEmailVerification) {
        toast.error(
          `An email has been sent to ${email}. Please follow the link to verify your email address and to
        complete your registration.`,
          getToastStyleProps(),
        );
      }
    } catch {
      toast.error(
        'An error occurred while signing in. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  const resendVerificationEmail = async () => {
    setResendVerificationEmailLoading(true);

    try {
      await nhost.auth.sendVerificationEmail({ email: emailFormValue });
      toast.success(
        `An new email has been sent to ${emailFormValue}. Please follow the link to verify your email address and to
      complete your registration.`,
        getToastStyleProps(),
      );
    } catch {
      toast.error(
        'An error occurred while sending the verification email. Please try again.',
        getToastStyleProps(),
      );
    } finally {
      setResendVerificationEmailLoading(false);
    }
  };

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-3.5xl font-semibold lg:text-4.5xl"
      >
        Sign In
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 bg-transparent"
          >
            <StyledInput
              {...register('email')}
              id="email"
              placeholder="Email"
              inputProps={{ min: 2, max: 128 }}
              spellCheck="false"
              autoCapitalize="none"
              type="email"
              label="Email"
              hideEmptyHelperText
              fullWidth
              error={!!formState.errors.email}
              helperText={formState.errors.email?.message}
              autoFocus
            />

            <StyledInput
              {...register('password')}
              id="password"
              placeholder="Password"
              inputProps={{ min: 2, max: 128 }}
              spellCheck="false"
              autoCapitalize="none"
              type="password"
              label="Password"
              hideEmptyHelperText
              fullWidth
              error={!!formState.errors.password}
              helperText={formState.errors.password?.message}
            />

            <NavLink
              href="/reset-password"
              color="white"
              className="justify-self-start font-semibold"
            >
              Forgot password?
            </NavLink>

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
              type="submit"
            >
              Sign In
            </Button>

            {!isEmailVerified && (
              <Button
                className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
                size="large"
                disabled={resendVerificationEmailLoading}
                loading={resendVerificationEmailLoading}
                type="button"
                onClick={resendVerificationEmail}
              >
                Resend verification email
              </Button>
            )}

            <Text color="secondary" className="text-center">
              or{' '}
              <NavLink color="white" className="font-semibold" href="/signin">
                sign in with GitHub
              </NavLink>
            </Text>
          </Form>
        </FormProvider>
      </Box>

      <Text color="secondary" className="text-center text-base lg:text-lg">
        Don&apos;t have an account?{' '}
        <NavLink href="/signup" color="white">
          Sign Up
        </NavLink>
      </Text>
    </>
  );
}

EmailSignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign In">{page}</UnauthenticatedLayout>;
};
