import { zodResolver } from '@hookform/resolvers/zod';
import bcrypt from 'bcryptjs';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormPasswordInput } from '@/components/form/FormPasswordInput';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { RemoteAppGetUsersAndAuthRolesQuery } from '@/generated/graphql';
import {
  useGetSignInMethodsQuery,
  useUpdateRemoteAppUserMutation,
} from '@/generated/graphql';
import type { DialogFormProps } from '@/types/common';

export interface EditUserPasswordFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * The selected user.
   */
  user: RemoteAppGetUsersAndAuthRolesQuery['users'][0];
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
  const { project } = useProject();
  const { data } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
  });

  const passwordMinLength =
    data?.config?.auth?.method?.emailPassword?.passwordMinLength || 1;

  const validationSchema = z
    .object({
      password: z
        .string()
        .min(
          passwordMinLength,
          `Password must be at least ${passwordMinLength} characters long.`,
        ),
      cpassword: z
        .string()
        .min(
          passwordMinLength,
          `Password must be at least ${passwordMinLength} characters long.`,
        ),
    })
    .refine((values) => values.password === values.cpassword, {
      message: 'Passwords do not match',
      path: ['cpassword'],
    });

  const [editUserPasswordFormError, setEditUserPasswordFormError] =
    useState<Error | null>(null);

  const form = useForm<z.infer<typeof validationSchema>>({
    reValidateMode: 'onSubmit',
    resolver: zodResolver(validationSchema),
    defaultValues: {
      password: '',
      cpassword: '',
    },
  });

  const handleSubmit = async ({
    password,
  }: z.infer<typeof validationSchema>) => {
    setEditUserPasswordFormError(null);
    const passwordHash = await bcrypt.hash(password, 10);

    const updateUserPasswordPromise = updateUser({
      variables: {
        id: user.id,
        user: { passwordHash },
      },
      client: remoteProjectGQLClient,
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateUserPasswordPromise;
      },
      {
        loadingMessage: 'Updating user password...',
        successMessage: 'User password updated successfully.',
        errorMessage: 'Failed to update user password.',
        onError: (error) => {
          setEditUserPasswordFormError(
            new Error(error.message || 'Something went wrong.'),
          );
        },
      },
    );

    closeDialog();
  };

  const {
    formState: { isSubmitting },
  } = form;

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="grid grid-flow-row gap-6 px-6 pb-6"
      >
        <FormPasswordInput
          control={form.control}
          name="password"
          label="Password"
          placeholder="Enter Password"
          autoComplete="off"
        />
        <FormPasswordInput
          control={form.control}
          name="cpassword"
          label="Confirm Password"
          placeholder="Enter Password"
          autoComplete="off"
        />
        {editUserPasswordFormError && (
          <Alert variant="destructive">
            <AlertDescription className="text-left">
              <strong>Error:</strong> {editUserPasswordFormError.message}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading type="submit" loading={isSubmitting}>
            Save
          </ButtonWithLoading>

          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
