import Form from '@/components/common/Form';
import NavLink from '@/components/common/NavLink';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Input, { inputClasses } from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { useSignUpEmailPassword } from '@nhost/nextjs';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
  password: Yup.string().label('Password').required(),
  displayName: Yup.string().label('Name').required(),
});

export type EmailSignUpFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function EmailSignUpPage() {
  const { signUpEmailPassword, error } = useSignUpEmailPassword();

  const form = useForm<EmailSignUpFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
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
  }: EmailSignUpFormValues) {
    try {
      await signUpEmailPassword(email, password, {
        displayName,
      });
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
        Sign Up with Email
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 bg-transparent"
          >
            <StyledInput
              {...register('displayName')}
              id="displayName"
              placeholder="Name"
              inputProps={{ min: 2, max: 128 }}
              spellCheck="false"
              autoCapitalize="none"
              type="text"
              label="Name"
              hideEmptyHelperText
              fullWidth
              autoComplete="off"
              error={!!formState.errors.displayName}
              helperText={formState.errors.displayName?.message}
            />

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

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
              type="submit"
            >
              Sign Up with Email
            </Button>

            <Text color="secondary" className="text-center">
              or{' '}
              <NavLink color="white" className="font-semibold" href="/signup">
                sign up with GitHub
              </NavLink>
            </Text>
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

      <Text color="secondary" className="text-center text-base lg:text-lg">
        Already have an account?{' '}
        <NavLink href="/signin" color="white">
          Sign in
        </NavLink>
      </Text>
    </>
  );
}

EmailSignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};
