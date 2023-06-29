import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { DialogFormProps } from '@/types/common';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import {
  useGetSignInMethodsQuery,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import bcrypt from 'bcryptjs';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface EditUserPasswordFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * The selected user.
   */
  user: RemoteAppGetUsersQuery['users'][0];
}

export default function EditUserPasswordForm({
  onCancel,
  user,
}: EditUserPasswordFormProps) {
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
  });
  const { closeDialog } = useDialog();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject?.id,
  });

  const passwordMinLength =
    data?.config?.auth?.method?.emailPassword?.passwordMinLength || 1;

  const validationSchema = Yup.object({
    password: Yup.string()
      .label('Password')
      .min(
        passwordMinLength,
        `Password must be at least ${passwordMinLength} characters long.`,
      )
      .required('This field is required.'),
    cpassword: Yup.string()
      .label('Password Confirmation')
      .min(
        passwordMinLength,
        `Password must be at least ${passwordMinLength} characters long.`,
      )
      .oneOf([Yup.ref('password')], 'Passwords do not match')
      .required('This field is required.'),
  });

  const [editUserPasswordFormError, setEditUserPasswordFormError] =
    useState<Error | null>(null);

  const form = useForm<Yup.InferType<typeof validationSchema>>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const handleSubmit = async ({
    password,
  }: Yup.InferType<typeof validationSchema>) => {
    setEditUserPasswordFormError(null);
    const passwordHash = await bcrypt.hash(password, 10);

    const updateUserPasswordPromise = updateUser({
      variables: {
        id: user.id,
        user: { passwordHash },
      },
      client: remoteProjectGQLClient,
    });

    try {
      await toast.promise(
        updateUserPasswordPromise,
        {
          loading: 'Updating user password...',
          success: 'User password updated successfully.',
          error: getServerError('Failed to update user password.'),
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
