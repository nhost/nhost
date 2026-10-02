import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormPasswordInput } from '@/components/form/FormPasswordInput';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isNotEmptyValue } from '@/lib/utils';
import type { DialogFormProps } from '@/types/common';

export interface CreateUserFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: () => Promise<unknown>;
}

export const validationSchema = z.object({
  email: z
    .string()
    .min(5, 'Email must be at least 5 characters long.')
    .email('Invalid email address'),
  password: z.string().min(1, 'This field is required.'),
});

export type CreateUserFormValues = z.infer<typeof validationSchema>;

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
    reValidateMode: 'onSubmit',
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const {
    formState: { isSubmitting, dirtyFields },
    setError,
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleCreateUser({ email, password }: CreateUserFormValues) {
    setCreateUserFormError(null);

    await execPromiseWithErrorToast(
      async () => {
        if (isNotEmptyValue(project)) {
          const baseAuthUrl = generateAppServiceUrl(
            project.subdomain,
            project.region,
            'auth',
          );
          const signUpUrl = `${baseAuthUrl}/signup/email-password`;

          const res = await fetch(signUpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();

          if (!res.ok) {
            if (res.status === 409) {
              setError('email', { message: data?.message });
            }
            throw new Error(data?.message || 'Something went wrong.');
          }

          onSubmit?.();

          return data;
        }
        throw new Error('Something went wrong. Please try again later.');
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
        <FormInput
          control={form.control}
          name="email"
          label="Email"
          placeholder="Enter Email"
          autoComplete="off"
          autoFocus
        />
        <FormPasswordInput
          control={form.control}
          name="password"
          label="Password"
          placeholder="Enter Password"
          autoComplete="off"
        />
        {createUserFormError && (
          <Alert
            variant="destructive"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <AlertDescription className="col-start-1 text-left">
              <strong>Error:</strong> {createUserFormError.message}
            </AlertDescription>

            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
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

          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
