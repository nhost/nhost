import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import ControlledSelect from '@/components/common/ControlledSelect';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import InputLabel from '@/components/ui/v2/InputLabel';
import Option from '@/components/ui/v2/Option';
import Text from '@/components/ui/v2/Text';
import Input from '@/ui/v2/Input';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { formatRelative } from 'date-fns';
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
   * The selected user.
   */
  user: RemoteAppGetUsersQuery['users'][0];
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export const EditUserFormValidationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('This field is required.'),
  password: Yup.string()
    .label('Users Password')
    .required('This field is required.'),
});

export default function EditUserForm({
  user,
  onSubmit,
  ...props
}: EditUserFormProps) {
  const { onDirtyStateChange } = useDialog();

  const form = useForm<EditUserFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserFormValidationSchema),
  });

  const {
    register,
    formState: { errors, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  return (
    <FormProvider {...form}>
      <Form className="divide-y border-y">
        <section className="grid grid-flow-row gap-6 p-6 px-6">
          <Text className="font-medium">{user.displayName}</Text>
          <Text className="font-medium text-greyscaleGreyDark">
            {user.email}
          </Text>
        </section>
        <section className="grid grid-flow-row grid-cols-4 gap-6 p-6 px-6">
          <InputLabel as="h3" className="col-span-1">
            User ID
          </InputLabel>
          <Text className="col-span-3 font-medium">{user.id}</Text>

          <InputLabel as="h3" className="col-span-1">
            Created
          </InputLabel>
          <Text className="col-span-3 font-medium">{user.createdAt}</Text>

          <InputLabel as="h3" className="col-span-1">
            Last Seen
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {formatRelative(new Date(), new Date(user.createdAt))}
          </Text>
        </section>
        <section className="grid grid-flow-row gap-6 p-6 px-6">
          <Input
            {...register('email')}
            id="Display Name"
            label="Display Name"
            variant="inline"
            placeholder="Enter Display Name"
            hideEmptyHelperText
            error={!!errors.email}
            helperText={errors?.email?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('email')}
            id="Avatar URL"
            label="Avatar URL"
            variant="inline"
            placeholder="Enter Avatar URL"
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
            id="password"
            label="Password"
            variant="inline"
            placeholder="Password is set"
            disabled
            hideEmptyHelperText
            error={!!errors.email}
            fullWidth
            autoComplete="off"
            helperText={<ControlledCheckbox label="Verified" />}
          />
          <Input
            {...register('email')}
            id="phoneNumber"
            label="Phone Number"
            variant="inline"
            placeholder="Enter Phone Number"
            hideEmptyHelperText
            error={!!errors.email}
            fullWidth
            autoComplete="off"
            helperText={<ControlledCheckbox label="Verified" />}
          />
          <ControlledSelect
            id="locale"
            name="locale"
            label="Locale"
            fullWidth
            variant="inline"
            hideEmptyHelperText
          >
            <Option value="en">en</Option>
          </ControlledSelect>
        </section>

        <section className="grid grid-flow-row gap-6 p-6 px-6">
          <InputLabel as="h3">User ID</InputLabel>
          <InputLabel as="h3">Created</InputLabel>
          <InputLabel as="h3">Last Seen</InputLabel>
        </section>
        <section className="grid grid-flow-row gap-6 p-6 px-6">
          <InputLabel as="h3">User ID</InputLabel>
          <InputLabel as="h3">Created</InputLabel>
          <InputLabel as="h3">Last Seen</InputLabel>
        </section>
      </Form>
    </FormProvider>
  );
}
