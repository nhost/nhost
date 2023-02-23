import Form from '@/components/common/Form';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import fetch from 'cross-fetch';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface CreateUserFormValues {
  /**
   * Email of the user to add to this project.
   */
  email: string;
  /**
   * Password for the user.
   */
  password: string;
}

export interface CreateUserFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSuccess?: VoidFunction;
}

export const CreateUserFormValidationSchema = Yup.object({
  email: Yup.string()
    .min(5, 'Email must be at least 5 characters long.')
    .email('Invalid email address')
    .required('This field is required.'),
  password: Yup.string()
    .label('Users Password')
    .min(8, 'Password must be at least 8 characters long.')
    .required('This field is required.'),
});

export default function CreateUserForm({
  onSuccess,
  onCancel,
}: CreateUserFormProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [createUserFormError, setCreateUserFormError] = useState<Error | null>(
    null,
  );

  const form = useForm<CreateUserFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(CreateUserFormValidationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting },
    setError,
  } = form;

  const baseAuthUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region?.awsName,
    'auth',
  );

  const signUpUrl = `${baseAuthUrl}/signup/email-password`;

  async function handleCreateUser({ email, password }: CreateUserFormValues) {
    setCreateUserFormError(null);

    try {
      await toast.promise(
        fetch(signUpUrl, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }).then(async (res) => {
          const data = await res.json();

          if (res.ok) {
            return data;
          }

          if (res.status === 409) {
            setError('email', { message: data?.message });
          }

          throw new Error(data?.message || 'Something went wrong.');
        }),
        {
          loading: 'Creating user...',
          success: 'User created successfully.',
          error: (arg) =>
            arg?.message
              ? `Error: ${arg.message}`
              : 'An error occurred while trying to create the user.',
        },
        getToastStyleProps(),
      );

      onSuccess?.();
    } catch {
      // Note: Error is already handled by toast.promise
    }
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleCreateUser}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
        <Input
          {...register('email')}
          id="email"
          label="Email"
          placeholder="Enter Email"
          hideEmptyHelperText
          error={!!errors.email}
          helperText={errors?.email?.message}
          fullWidth
          autoComplete="off"
          autoFocus
        />
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
          type="password"
        />
        {createUserFormError && (
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createUserFormError.message}
            </span>

            <Button
              variant="borderless"
              color="error"
              size="small"
              onClick={() => {
                setCreateUserFormError(null);
              }}
            >
              Clear
            </Button>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            Create
          </Button>

          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
