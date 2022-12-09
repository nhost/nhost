import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { useUpdateRemoteAppUserMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import bcrypt from 'bcryptjs';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface EditUserPasswordFormValues {
  /**
   * Password for the user.
   */
  password: string;
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

export const EditUserPasswordFormValidationSchema = Yup.object({
  password: Yup.string()
    .label('Users Password')
    .required('This field is required.'),
});

export default function EditUserPasswordForm({
  onCancel,
  user,
}: EditUserPasswordFormProps) {
  const { onDirtyStateChange } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [updateUser] = useUpdateRemoteAppUserMutation();

  const form = useForm<EditUserPasswordFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserPasswordFormValidationSchema),
  });

  const handleSubmit = async ({ password }: EditUserPasswordFormValues) => {
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

    await toast.promise(
      updateUserPasswordPromise,
      {
        loading: 'Updating user password...',
        success: 'User password updated successfully.',
        error: 'Failed to update user password.',
      },
      toastStyleProps,
    );
  };

  const {
    register,
    formState: { errors, dirtyFields, isSubmitting },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="grid grid-flow-row gap-6 p-6 px-6"
      >
        <Input
          {...register('password')}
          id="password"
          label="Password"
          placeholder="Enter Password"
          hideEmptyHelperText
          error={!!errors.password}
          helperText={errors?.password?.message}
          fullWidth
          autoComplete="off"
        />
        <Input
          {...register('password')}
          id="password"
          label="Confirm Password"
          placeholder="Enter Password"
          hideEmptyHelperText
          error={!!errors.password}
          helperText={errors?.password?.message}
          fullWidth
          autoComplete="off"
        />
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
