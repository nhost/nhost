import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import ControlledSelect from '@/components/common/ControlledSelect';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import IconButton from '@/components/ui/v2/IconButton';
import InputAdornment from '@/components/ui/v2/InputAdornment';
import Chip from '@/ui/v2/Chip';
import Input from '@/ui/v2/Input';
import InputLabel from '@/ui/v2/InputLabel';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import Text from '@/ui/v2/Text';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { Avatar } from '@mui/material';
import { format, formatRelative } from 'date-fns';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

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
  displayName: Yup.string().required('This field is required.'),
  avatarURL: Yup.string().required('This field is required.'),
  email: Yup.string()
    .email('Invalid email address')
    .required('This field is required.'),
  // password: Yup.string()
  //   .label('Users Password')
  //   .required('This field is required.'),
  phoneNumber: Yup.string(),
});

export type EditUserFormValues = Yup.InferType<
  typeof EditUserFormValidationSchema
>;

export default function EditUserForm({
  user,
  onSubmit,
  ...props
}: EditUserFormProps) {
  const { onDirtyStateChange, openDialog } = useDialog();

  const form = useForm<EditUserFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserFormValidationSchema),
    defaultValues: {
      avatarURL: user.avatarUrl,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
  });

  const {
    register,
    formState: { errors, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  function handleChangeUserPassword() {
    openDialog('CREATE_USER', {
      title: 'Change Password',
      props: {
        titleProps: { className: 'mx-auto' },
        PaperProps: { className: 'max-w-md' },
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form className="divide-y border-y">
        <section className="grid grid-flow-col grid-cols-7 p-6">
          <div className="grid grid-flow-col col-span-6 gap-4 place-content-start">
            <Avatar className="relative inline-flex items-center justify-center w-12 h-12 overflow-hidden bg-gray-300 rounded-full">
              <span className="text-xs font-medium text-gray-600 uppercase">
                {user.displayName.slice(0, 2)}
              </span>
            </Avatar>
            <div className="grid items-center grid-flow-row">
              <Text className="text-lg font-medium">{user.displayName}</Text>
              <Text className="font-normal text-sm+ text-greyscaleGreyDark">
                {user.email}
              </Text>
            </div>
          </div>
          <div className='items-center'>
            <Select
              className="w-full text-sm font-normal text-greyscaleDark"
              placeholder="Actions"
              aria-label="Select service"
              hideEmptyHelperText
              slotProps={{
                root: { className: 'min-h-[initial] h-9 leading-[initial]' },
              }}
            >
              <Option
                value="Actions"
                className="text-sm+ font-medium text-greyscaleGreyDark"
              >
                Actions
              </Option>
            </Select>
          </div>
        </section>
        <section className="grid grid-flow-row grid-cols-4 gap-6 p-6 px-6">
          <InputLabel as="h3" className="col-span-1">
            User ID
          </InputLabel>
          <Text className="col-span-3 font-medium">{user.id}</Text>

          <InputLabel as="h3" className="col-span-1">
            Created
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {format(new Date(user.createdAt), 'd MMM yyyy')}
          </Text>

          <InputLabel as="h3" className="col-span-1">
            Last Seen
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {formatRelative(new Date(), new Date(user.createdAt))}
          </Text>
        </section>
        <section className="grid grid-flow-row gap-6 p-6 px-6">
          <Input
            {...register('displayName')}
            id="Display Name"
            label="Display Name"
            variant="inline"
            placeholder="Enter Display Name"
            hideEmptyHelperText
            error={!!errors.displayName}
            helperText={errors?.displayName?.message}
            fullWidth
            autoComplete="off"
          />
          <Input
            {...register('avatarURL')}
            id="Avatar URL"
            label="Avatar URL"
            variant="inline"
            placeholder="Enter Avatar URL"
            hideEmptyHelperText
            error={!!errors.avatarURL}
            helperText={errors?.avatarURL?.message}
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
            endAdornment={
              <InputAdornment position="end" className="absolute right-2">
                <IconButton
                  color="primary"
                  variant="borderless"
                  className="px-2"
                  onClick={handleChangeUserPassword}
                >
                  Change
                </IconButton>
              </InputAdornment>
            }
          />
          <Input
            {...register('phoneNumber')}
            id="phoneNumber"
            label="Phone Number"
            variant="inline"
            placeholder="Enter Phone Number"
            hideEmptyHelperText
            error={!!errors.phoneNumber}
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

        <section className="grid grid-flow-col grid-cols-2 p-6 px-6">
          <div className="col-span-1">
            <InputLabel as="h3">Sign-In Methods</InputLabel>
          </div>
          <div className="grid grid-flow-col col-span-1 place-content-between">
            <Text className="font-medium">Email + Password</Text>
            <Chip component="span" color="info" size="small" label="Active" />
          </div>
        </section>
        <section className="grid grid-flow-row gap-6 p-6 px-6">
          <InputLabel as="h3">Default Role</InputLabel>
          <InputLabel as="h3">Allowed Role</InputLabel>
        </section>
      </Form>
    </FormProvider>
  );
}
