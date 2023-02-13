import Form from '@/components/common/Form';
import NavLink from '@/components/common/NavLink';
import UnauthenticatedLayout from '@/components/layout/UnauthenticatedLayout';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Input, { inputClasses } from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { useResetPassword } from '@nhost/nextjs';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
});

export type ResetPasswordFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function ResetPasswordPage() {
  const { resetPassword, error, isSent } = useResetPassword();

  const form = useForm<ResetPasswordFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState, getValues } = form;

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error(
      error?.message || 'An error occurred while signing in. Please try again.',
      getToastStyleProps(),
    );
  }, [error]);

  async function handleSubmit({ email }: ResetPasswordFormValues) {
    try {
      await resetPassword(email);
    } catch {
      toast.error(
        'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  if (isSent) {
    return (
      <div className="text-center">
        We&apos;ve sent a temporary link to reset your password. Check your
        inbox at {getValues('email')}.
      </div>
    );
  }

  return (
    <>
      <Text
        variant="h2"
        component="h1"
        className="text-center text-3.5xl font-semibold lg:text-4.5xl"
      >
        Reset Password
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
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
              fullWidth
              inputProps={{ min: 2, max: 128 }}
              spellCheck="false"
              autoCapitalize="none"
              error={!!formState.errors.email}
              helperText={formState.errors.email?.message}
            />

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Send Reset Instructions
            </Button>
          </Form>
        </FormProvider>
      </Box>

      <Text color="secondary" className="text-center text-base lg:text-lg">
        Is your password okay?{' '}
        <NavLink href="/signin" color="white" className="font-medium">
          Sign in
        </NavLink>
      </Text>
    </>
  );
}

ResetPasswordPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout title="Reset Password">{page}</UnauthenticatedLayout>
  );
};
