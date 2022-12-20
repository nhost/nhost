import Form from '@/components/common/Form';
import Alert from '@/components/ui/Alert';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { generateAppServiceUrl } from '@/utils/helpers';
import { yupResolver } from '@hookform/resolvers/yup';
import axios from 'axios';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
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
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
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
  onCancel,
  onSubmit,
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

  const signUpUrl = `${generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
    'auth',
  )}/v1/signup/email-password`;

  async function handleCreateUser({ email, password }: CreateUserFormValues) {
    setCreateUserFormError(null);

    try {
      await axios.post(signUpUrl, {
        email,
        password,
      });
    } catch (error) {
      if (error.response?.status === 409) {
        setError('email', {
          message: error.response.data.message,
        });
        return;
      }
      setCreateUserFormError(
        new Error(error.response.data.message || 'Something went wrong.'),
      );
    }
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleCreateUser}
        className="grid grid-flow-row gap-6 p-6 px-6"
        autoComplete="off"
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
            className="grid items-center justify-between grid-flow-col px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createUserFormError.message}
            </span>

            <Button
              variant="borderless"
              color="error"
              className="p-1 text-greyscaleDark hover:text-greyscaleDark"
              onClick={() => {
                setCreateUserFormError(null);
              }}
            >
              Clear
            </Button>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <Button type="submit" loading={isSubmitting}>
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
