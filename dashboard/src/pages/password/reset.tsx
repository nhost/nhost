import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { NavLink } from '@/components/common/NavLink';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { SignInRightColumn } from '@/components/auth/SignInRightColumn';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useNhostClient } from '@/providers/nhost';

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

export default function ResetPasswordPage() {
  const router = useRouter();
  const nhost = useNhostClient();

  const form = useForm<ResetPasswordFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { formState } = form;

  const changePassword = useActionWithElevatedPermissions({
    actionFn: nhost.auth.changeUserPassword,
    onSuccess: () => {
      router.push('/');
    },
    successMessage: 'Password was updated successfully.',
  });

  async function handleSubmit({ newPassword }: ResetPasswordFormValues) {
    await changePassword({ newPassword });
  }

  return (
    <>
      <h1 className="text-center font-semibold text-3.5xl lg:text-4.5xl">
        Change password
      </h1>

      <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid grid-flow-row gap-4 [&&]:bg-transparent"
          >
            <FormInput
              control={form.control}
              name="newPassword"
              type="password"
              label="New Password"
              className="!bg-transparent border-border"
            />

            <FormInput
              control={form.control}
              name="confirmNewPassword"
              type="password"
              label="Confirm New Password"
              className="!bg-transparent border-border"
            />

            <ButtonWithLoading
              size="lg"
              type="submit"
              disabled={formState.isSubmitting}
              loading={formState.isSubmitting}
            >
              Change password
            </ButtonWithLoading>
          </Form>
        </FormProvider>
      </div>

      <div className="rounded-md border bg-transparent p-4 text-center text-base text-muted-foreground lg:text-lg">
        Go back to{' '}
        <NavLink
          href="/signin/email"
          className="px-0 font-medium text-lg"
        >
          Sign In
        </NavLink>
      </div>
    </>
  );
}

ResetPasswordPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout
      title="Request Password Reset"
      rightColumnContent={<SignInRightColumn />}
    >
      {page}
    </UnauthenticatedLayout>
  );
};
