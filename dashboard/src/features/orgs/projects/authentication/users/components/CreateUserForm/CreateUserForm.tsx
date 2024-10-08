import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DialogFormProps } from '@/types/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface CreateUserFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
}

export const validationSchema = Yup.object({
  email: Yup.string()
    .min(5, 'Email must be at least 5 characters long.')
    .email('Invalid email address')
    .required('This field is required.'),
  password: Yup.string()
    .label('Users Password')
    .required('This field is required.'),
});

export type CreateUserFormValues = Yup.InferType<typeof validationSchema>;

export default function CreateUserForm({
  onSubmit,
  onCancel,
  location,
}: CreateUserFormProps) {
  const { onDirtyStateChange } = useDialog();
  const { project } = useProject();
  const [createUserFormError, setCreateUserFormError] = useState<Error | null>(
    null,
  );

  const form = useForm<CreateUserFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
    setError,
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const baseAuthUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'auth',
  );

  const signUpUrl = `${baseAuthUrl}/signup/email-password`;

  async function handleCreateUser({ email, password }: CreateUserFormValues) {
    setCreateUserFormError(null);

    await execPromiseWithErrorToast(
      async () => {
        await fetch(signUpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        });

        onSubmit?.();
      },
      {
        loadingMessage: 'Creating user...',
        successMessage: 'User has been created successfully.',
        errorMessage: 'An error occurred while trying to create the user.',
      },
    );
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
          <Button type="submit" disabled={isSubmitting}>
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
