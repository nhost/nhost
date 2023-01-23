import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import ControlledSelect from '@/components/common/ControlledSelect';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputLabel from '@/ui/v2/InputLabel';
import Option from '@/ui/v2/Option';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import getUserRoles from '@/utils/settings/getUserRoles';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetRolesQuery,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { Avatar } from '@mui/material';
import { format } from 'date-fns';
import Image from 'next/image';
import type { RemoteAppUser } from 'pages/[workspaceSlug]/[appSlug]/users';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface EditUserFormProps {
  /**
   * This is the selected user from the user's table.
   */
  user: RemoteAppUser;
  /**
   * Function to be called when the form is submitted.
   */
  onEditUser?: (
    values: EditUserFormValues,
    user: RemoteAppUser,
  ) => Promise<void>;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when banning the user.
   */
  onBanUser?: (user: RemoteAppUser) => Promise<void>;
  /**
   * Function to be called when deleting the user.
   */
  onDeleteUser: (user: RemoteAppUser) => Promise<void>;
  /**
   * User roles
   */
  roles: { [key: string]: boolean }[];
  /**
   * Function to be called after a successful action.
   */
  onSuccessfulAction?: () => Promise<void> | void;
}

export const EditUserFormValidationSchema = Yup.object({
  displayName: Yup.string(),
  avatarURL: Yup.string(),
  email: Yup.string()
    .email('Invalid email address')
    .required('This field is required.'),
  emailVerified: Yup.boolean().optional(),
  phoneNumber: Yup.string().nullable(),
  phoneNumberVerified: Yup.boolean().optional(),
  locale: Yup.string(),
  defaultRole: Yup.string(),
  roles: Yup.array().of(Yup.boolean()),
});

export type EditUserFormValues = Yup.InferType<
  typeof EditUserFormValidationSchema
>;

export default function EditUserForm({
  user,
  onEditUser,
  onCancel,
  onDeleteUser,
  roles,
  onSuccessfulAction,
}: EditUserFormProps) {
  const { onDirtyStateChange, openDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const isAnonymous = user.roles.some((role) => role.role === 'anonymous');
  const [isUserBanned, setIsUserBanned] = useState(user.disabled);
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
  });

  const form = useForm<EditUserFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(EditUserFormValidationSchema),
    defaultValues: {
      avatarURL: user.avatarUrl,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      locale: user.locale,
      defaultRole: user.defaultRole,
      roles: roles.map((role) => Object.values(role)[0]),
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields, isSubmitting, isValidating },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'drawer');
  }, [isDirty, onDirtyStateChange]);

  function handleChangeUserPassword() {
    openDialog('EDIT_USER_PASSWORD', {
      title: 'Change Password',
      payload: { user },
    });
  }

  const { data: dataRoles } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  const allAvailableProjectRoles = getUserRoles(
    dataRoles?.app?.authUserDefaultAllowedRoles,
  );

  /**
   * This will change the `disabled` field in the user to its opposite.
   * If the user is disabled, it will be enabled and vice versa.
   * We are tracking the `disabled` field as a react state variable in order to avoid
   * both having to refetch this single user from the database again or causing a re-render of the drawer.
   */
  async function handleUserDisabledStatus() {
    const banUser = updateUser({
      variables: {
        id: user.id,
        user: {
          disabled: !isUserBanned,
        },
      },
    });

    await toast.promise(
      banUser,
      {
        loading: user.disabled ? 'Unbanning user...' : 'Banning user...',
        success: user.disabled
          ? 'User unbanned successfully.'
          : 'User banned successfully',
        error: user.disabled
          ? 'An error occurred while trying to unban the user.'
          : 'An error occurred while trying to ban the user.',
      },
      { ...toastStyleProps },
    );
    await onSuccessfulAction();
  }

  return (
    <FormProvider {...form}>
      <Form
        className="flex flex-col border-gray-200 lg:content-between lg:flex-auto border-t-1"
        onSubmit={handleSubmit(async (values) => {
          await onEditUser(values, user);
        })}
      >
        <div className="flex-auto divide-y">
          <section className="grid grid-flow-col p-6 lg:grid-cols-7">
            <div className="grid items-center grid-flow-col col-span-6 gap-4 place-content-start">
              <Avatar className="w-12 h-12 border" src={user.avatarUrl} />
              <div className="grid items-center grid-flow-row">
                <Text className="text-lg font-medium">{user.displayName}</Text>
                <Text className="font-normal text-sm+ text-greyscaleGreyDark">
                  {user.email}
                </Text>
              </div>
              {isUserBanned && (
                <Chip
                  component="span"
                  color="error"
                  size="small"
                  label="Banned"
                  className="self-center align-middle"
                />
              )}
            </div>
            <div>
              <Dropdown.Root>
                <Dropdown.Trigger autoFocus={false} asChild className="gap-2">
                  <Button variant="outlined" color="secondary">
                    Actions
                  </Button>
                </Dropdown.Trigger>
                <Dropdown.Content menu disablePortal className="w-full h-full">
                  <Dropdown.Item
                    className="font-medium text-red"
                    onClick={() => {
                      handleUserDisabledStatus();
                      setIsUserBanned((s) => !s);
                    }}
                  >
                    {isUserBanned ? 'Unban User' : 'Ban User'}
                  </Dropdown.Item>
                  <Dropdown.Item
                    className="font-medium text-red"
                    onClick={() => {
                      onDeleteUser(user);
                    }}
                  >
                    Delete User
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Root>
            </div>
          </section>
          <section className="grid grid-flow-row grid-cols-4 gap-8 p-6">
            <InputLabel as="h3" className="self-center col-span-1">
              User ID
            </InputLabel>
            <div className="grid items-center justify-start grid-flow-col col-span-3 gap-2">
              <Text className="font-medium truncate">{user.id}</Text>
              <IconButton
                variant="borderless"
                color="secondary"
                aria-label="Copy User ID"
                onClick={(e) => {
                  e.stopPropagation();
                  copy(user.id, 'User ID');
                }}
              >
                <CopyIcon className="w-4 h-4" />
              </IconButton>
            </div>

            <InputLabel as="h3" className="self-center col-span-1 ">
              Created At
            </InputLabel>
            <Text className="col-span-3 font-medium">
              {format(new Date(user.createdAt), 'yyyy-MM-dd hh:mm:ss')}
            </Text>

            <InputLabel as="h3" className="self-center col-span-1 ">
              Last Seen
            </InputLabel>
            <Text className="col-span-3 font-medium">
              {user.lastSeen
                ? `${format(new Date(user.lastSeen), 'yyyy-mm-dd hh:mm:ss')}`
                : '-'}
            </Text>
          </section>
          <section className="grid grid-flow-row gap-8 p-6">
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
              helperText={
                errors.email ? (
                  errors?.email?.message
                ) : (
                  <ControlledCheckbox
                    id="emailVerified"
                    name="emailVerified"
                    label="Verified"
                  />
                )
              }
              fullWidth
              autoComplete="off"
            />

            <div className="grid items-center grid-flow-col grid-cols-8 col-span-1 my-1">
              <div className="col-span-2 ">
                <InputLabel as="h3">Password</InputLabel>
              </div>
              <Button
                color="primary"
                variant="borderless"
                className="col-span-6 px-2 place-self-start"
                onClick={handleChangeUserPassword}
              >
                Change
              </Button>
            </div>

            <Input
              {...register('phoneNumber')}
              id="phoneNumber"
              label="Phone Number"
              variant="inline"
              placeholder="Enter Phone Number"
              error={!!errors.phoneNumber}
              fullWidth
              autoComplete="off"
              helperText={
                errors.phoneNumber ? (
                  errors?.phoneNumber?.message
                ) : (
                  <ControlledCheckbox
                    id="phoneNumberVerified"
                    name="phoneNumberVerified"
                    label="Verified"
                    disabled={!form.watch('phoneNumber')}
                  />
                )
              }
            />
            <ControlledSelect
              {...register('locale')}
              id="locale"
              variant="inline"
              label="Locale"
              slotProps={{ root: { className: 'truncate' } }}
              fullWidth
              error={!!errors.locale}
              helperText={errors?.locale?.message}
            >
              <Option key="en" value="en">
                en
              </Option>
              <Option key="fr" value="fr">
                fr
              </Option>
            </ControlledSelect>
          </section>
          <section className="grid gap-4 p-6 lg:grid-cols-4 place-content-start">
            <div className="items-center self-center col-span-1 align-middle">
              <InputLabel as="h3">OAuth Providers</InputLabel>
            </div>
            <div className="grid w-full grid-flow-row col-span-3 gap-y-6">
              {user.userProviders.length === 0 && (
                <div className="grid grid-flow-col gap-x-1 place-content-between">
                  <Text className="font-normal text-greyscaleGrey">
                    This user has no OAuth providers connected.
                  </Text>
                </div>
              )}

              {user.userProviders.map((provider) => (
                <div
                  className="grid grid-flow-col gap-3 place-content-between"
                  key={provider.id}
                >
                  <div className="grid grid-flow-col gap-3 span-cols-1">
                    <Image
                      src={`/logos/${
                        provider.providerId[0].toUpperCase() +
                        provider.providerId.slice(1)
                      }.svg`}
                      width={25}
                      height={25}
                    />
                    <Text className="font-medium capitalize">
                      {provider.providerId === 'github'
                        ? 'GitHub'
                        : provider.providerId}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </section>
          {!isAnonymous && (
            <section className="grid grid-flow-row p-6 gap-y-10">
              <ControlledSelect
                {...register('defaultRole')}
                id="defaultRole"
                name="defaultRole"
                variant="inline"
                label="Default Role"
                slotProps={{ root: { className: 'truncate' } }}
                hideEmptyHelperText
                fullWidth
                error={!!errors.defaultRole}
                helperText={errors?.defaultRole?.message}
              >
                {allAvailableProjectRoles.map((role) => (
                  <Option key={role.name} value={role.name}>
                    {role.name}
                  </Option>
                ))}
              </ControlledSelect>
              <div className="grid grid-flow-row gap-6 lg:grid-cols-8 lg:grid-flow-col place-content-start">
                <InputLabel as="h3" className="col-span-2">
                  Allowed Roles
                </InputLabel>
                <div className="grid grid-flow-row col-span-3 gap-6">
                  {roles.map((role, i) => (
                    <ControlledCheckbox
                      id={`roles.${i}`}
                      label={Object.keys(role)[0]}
                      defaultChecked={Object.values(role)[0]}
                      name={`roles.${i}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="grid justify-between flex-shrink-0 w-full grid-flow-col gap-3 p-2 border-gray-200 place-self-end border-t-1 snap-end">
          <Button
            variant="outlined"
            color="secondary"
            tabIndex={isDirty ? -1 : 0}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            className="justify-self-end"
            disabled={!isDirty}
            loading={isSubmitting || isValidating}
          >
            Save
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
