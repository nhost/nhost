import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import Input from '@/ui/v2/Input';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface EditUserFormValues {
  /**
   * Email of the user to add to this project.
   */
  email: string;
  /**
   * Password for the user.
   */
  password: string;
}

export interface EditUserFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export const EditUserFormValidationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('This field is required.'),
  password: Yup.string()
    .label('Users Password')
    .required('This field is required.'),
});

export default function EditUserForm() {
  const { onDirtyStateChange } = useDialog();

  const form = useForm<EditUserFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserFormValidationSchema),
  });

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
      <Form className="grid grid-flow-row gap-6 p-6 px-6">
        <Input
          {...register('email')}
          id="email"
          label="Email"
          variant="inline"
          placeholder="Enter Email"
          hideEmptyHelperText
          error={!!errors.email}
          helperText={errors?.email?.message}
          fullWidth
          autoComplete="off"
        />
        <Input
          {...register('email')}
          id="email"
          label="Email"
          variant="inline"
          placeholder="Enter Email"
          hideEmptyHelperText
          error={!!errors.email}
          helperText={errors?.email?.message}
          fullWidth
          autoComplete="off"
        />
        <Input
          {...register('email')}
          id="email"
          label="Email"
          variant="inline"
          placeholder="Enter Email"
          hideEmptyHelperText
          error={!!errors.email}
          helperText={errors?.email?.message}
          fullWidth
          autoComplete="off"
        />
        <Input
          {...register('email')}
          id="email"
          label="Email"
          variant="inline"
          placeholder="Enter Email"
          hideEmptyHelperText
          error={!!errors.email}
          helperText={errors?.email?.message}
          fullWidth
          autoComplete="off"
        />
        <Input
          {...register('email')}
          id="email"
          label="Email"
          variant="inline"
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
          variant="inline"
          label="Password"
          placeholder="Enter Password"
          hideEmptyHelperText
          error={!!errors.password}
          helperText={errors?.password?.message}
          fullWidth
          autoComplete="off"
        />
      </Form>
    </FormProvider>
  );
}
