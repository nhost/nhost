import Form from '@/components/common/Form';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Input, { inputClasses } from '@/ui/v2/Input';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { styled } from '@mui/material';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().email().required(),
  password: Yup.string().required(),
  displayName: Yup.string().required(),
});

export type EmailSignUpFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function EmailSignUpPage() {
  const [loading, setLoading] = useState(false);
  const form = useForm<EmailSignUpFormValues>({
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
    },
  });

  const { register } = form;

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-4.5xl font-semibold"
      >
        Sign Up with Email
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-12">
        <FormProvider {...form}>
          <Form className="grid grid-flow-row gap-4 bg-transparent">
            <StyledInput
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

            <StyledInput
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

            <StyledInput
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

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
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
              Sign Up with Email
            </Button>

            <Text color="secondary" className="text-center">
              or{' '}
              <Link color="white" className="font-semibold" href="/signup">
                sign up with GitHub
              </Link>
            </Text>
          </Form>
        </FormProvider>

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

EmailSignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};
