import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { NavLink } from '@/components/common/NavLink';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
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
              className="!bg-transparent border-border text-white placeholder:text-white"
            />

            <FormInput
              control={form.control}
              name="confirmNewPassword"
              type="password"
              label="Confirm New Password"
              className="!bg-transparent border-border text-white placeholder:text-white"
            />

            <ButtonWithLoading
              className="!bg-white !text-black disabled:!text-black disabled:!text-opacity-60"
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

      <p className="text-center text-[#A2B3BE] text-base lg:text-lg">
        Go back to{' '}
        <NavLink
          href="/signin/email"
          className="px-0 font-medium text-[1.125rem] text-white"
        >
          Sign In
        </NavLink>
      </p>
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
