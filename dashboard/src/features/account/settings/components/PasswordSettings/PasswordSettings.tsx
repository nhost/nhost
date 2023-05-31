import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { useChangePassword } from '@nhost/nextjs';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  newPassword: Yup.string()
    .label('New Password')
    .nullable()
    .required('This field is required.'),
  confirmPassword: Yup.string()
    .label('Confirm Password')
    .nullable()
    .required('This field is required.')
    .test(
      'passwords-match',
      'Passwords must match.',
      (value, ctx) => ctx.parent.newPassword === value,
    ),
});

export type PasswordSettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function PasswordSettings() {
  const { changePassword } = useChangePassword();
  const form = useForm<PasswordSettingsFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const { register, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  async function handleSubmit(formValues: PasswordSettingsFormValues) {
    try {
      const changePasswordPromise = changePassword(formValues.newPassword);

      await toast.promise(
        changePasswordPromise,
        {
          loading: 'Changing password...',
          success: 'The password has been changed successfully.',
          error: getServerError(
            'An error occurred while trying to update the password. Please try again.',
          ),
        },
        getToastStyleProps(),
      );

      form.reset();
    } catch {
      // Note: The error is handled by the toast.
    }
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Change Password"
          description="Update your account password."
          slotProps={{
            submitButton: {
              disabled: !isDirty,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row lg:grid-cols-5"
        >
          <Input
            {...register('newPassword')}
            className="col-span-2"
            type="password"
            id="new-password"
            label="New Password"
            fullWidth
            helperText={formState.errors.newPassword?.message}
            error={Boolean(formState.errors.newPassword)}
          />

          <Input
            {...register('confirmPassword')}
            className="col-span-2 row-start-2"
            type="password"
            id="confirm-password"
            label="Confirm Password"
            fullWidth
            helperText={formState.errors.confirmPassword?.message}
            error={Boolean(formState.errors.confirmPassword)}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
