import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { generateAppServiceUrl } from '@/utils/helpers';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import axios from 'axios';
import { useEffect } from 'react';
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
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export const CreateUserFormValidationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('This field is required.'),
  password: Yup.string()
    .label('Users Password')
    .required('This field is required.'),
});

export default function CreateUserForm({
  onCancel,
  onSubmit,
}: CreateUserFormProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { onDirtyStateChange, closeDialog } = useDialog();

  const form = useForm<CreateUserFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(CreateUserFormValidationSchema),
  });

  const signUpUrl = `${generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
    'auth',
  )}/v1/signup/email-password`;

  console.log(onSubmit);

  async function handleSubmit({ email, password }: CreateUserFormValues) {
    await toast.promise(
      axios.post(signUpUrl, {
        email,
        password,
      }),
      {
        loading: 'Creating new user...',
        success: 'New user created successfully.',
        error: 'An error occurred while creating a new user.',
      },
      toastStyleProps,
    );

    onSubmit?.();
    closeDialog();
  }

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
        />
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
