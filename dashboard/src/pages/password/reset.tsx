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
import { useChangePassword } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  newPassword: Yup.string()
    .label('New Password')
    .required('New Password is required'),
  confirmNewPassword: Yup.string()
    .label('Confirm New Password')
    .required('Confirm New Password is required')
    .oneOf([Yup.ref('newPassword')], 'Passwords must match'),
});

export type ResetPasswordFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function ResetPasswordPage() {
  const router = useRouter();
  const { changePassword } = useChangePassword();

  const form = useForm<ResetPasswordFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState } = form;

  async function handleSubmit({ newPassword }: ResetPasswordFormValues) {
    try {
      const password = newPassword;

      const { isError, error } = await changePassword(password);

      if (isError) {
        toast.error(
          `An error occurred while changing your password: ${error.message}`,
          getToastStyleProps(),
        );

        return;
      }

      toast.success('Password was updated successfully.');
      router.push('/');
    } catch {
      toast.error(
        'An error occurred while updating your password. Please try again.',
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
        Change password
      </Text>

      <Box className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 bg-transparent"
          >
            <StyledInput
              {...register('newPassword')}
              type="password"
              id="newPassword"
              label="New Password"
              fullWidth
              inputProps={{ min: 2, max: 128 }}
              error={!!formState.errors.newPassword}
              helperText={formState.errors.newPassword?.message}
            />

            <StyledInput
              {...register('confirmNewPassword')}
              type="password"
              id="confirmNewPassword"
              label="Confirm New Password"
              fullWidth
              inputProps={{ min: 2, max: 128 }}
              error={!!formState.errors.confirmNewPassword}
              helperText={formState.errors.confirmNewPassword?.message}
            />

            <Button
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
              size="large"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Change password
            </Button>
          </Form>
        </FormProvider>
      </Box>

      <Text color="secondary" className="text-center text-base lg:text-lg">
        Go back to{' '}
        <NavLink href="/signin/email" color="white" className="font-medium">
          Sign In
        </NavLink>
      </Text>
    </>
  );
}

ResetPasswordPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout title="Request Password Reset">
      {page}
    </UnauthenticatedLayout>
  );
};
