import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { useUpdateRemoteAppUserMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import bcrypt from 'bcryptjs';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface EditUserPasswordFormValues {
  /**
   * Password for the user.
   */
  password: string;
  /**
   * Confirm Password for the user.
   */
  cpassword: string;
}

export interface EditUserPasswordFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * The selected user.
   */
  user: RemoteAppGetUsersQuery['users'][0];
}

export const EditUserPasswordFormValidationSchema = Yup.object().shape({
  password: Yup.string()
    .label('Users Password')
    .min(8, 'Password must be at least 8 characters long.')
    .required('This field is required.'),
  cpassword: Yup.string()
    .required('Confirm Password is required')
    .min(8, 'Password must be at least 8 characters long.')
    .oneOf([Yup.ref('password')], 'Passwords do not match'),
});

export default function EditUserPasswordForm({
  onCancel,
  user,
}: EditUserPasswordFormProps) {
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
  });
  const { closeDialog } = useDialog();

  const [editUserPasswordFormError, setEditUserPasswordFormError] =
    useState<Error | null>(null);

  const form = useForm<EditUserPasswordFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserPasswordFormValidationSchema),
  });

  const handleSubmit = async ({ password }: EditUserPasswordFormValues) => {
    setEditUserPasswordFormError(null);
    const passwordHash = await bcrypt.hash(password, 10);

    const updateUserPasswordPromise = updateUser({
      variables: {
        id: user.id,
        user: {
          passwordHash,
        },
      },
      client: remoteProjectGQLClient,
    });

    try {
      await toast.promise(
        updateUserPasswordPromise,
        {
          loading: 'Updating user password...',
          success: 'User password updated successfully.',
          error: 'Failed to update user password.',
        },
        getToastStyleProps(),
      );
    } catch (error) {
      setEditUserPasswordFormError(
        new Error(error.message || 'Something went wrong.'),
      );
    } finally {
      closeDialog();
    }
  };

  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="grid grid-flow-row gap-6 px-6 pb-6"
      >
        <Input
          {...register('password')}
          id="password"
          type="password"
          label="Password"
          placeholder="Enter Password"
          hideEmptyHelperText
          error={!!errors.password}
          helperText={errors?.password?.message}
          fullWidth
          autoComplete="off"
          autoFocus
        />
        <Input
          {...register('cpassword')}
          id="confirm-password"
          type="password"
          label="Confirm Password"
          placeholder="Enter Password"
          hideEmptyHelperText
          error={!!errors.cpassword}
          helperText={errors?.cpassword?.message}
          fullWidth
          autoComplete="off"
        />
        {editUserPasswordFormError && (
          <Alert severity="error">
            <span className="text-left">
              <strong>Error:</strong> {editUserPasswordFormError.message}
            </span>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <Button type="submit" loading={isSubmitting}>
            Save
          </Button>

          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
