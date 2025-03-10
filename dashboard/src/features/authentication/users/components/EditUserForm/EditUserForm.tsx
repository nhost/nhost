import { useDialog } from '@/components/common/DialogProvider';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import { EditUserPasswordForm } from '@/features/authentication/users/components/EditUserPasswordForm';
import { getReadableProviderName } from '@/features/authentication/users/utils/getReadableProviderName';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getUserRoles } from '@/features/projects/roles/settings/utils/getUserRoles';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { DialogFormProps } from '@/types/common';
import {
  RemoteAppGetUsersAndAuthRolesDocument,
  useGetProjectLocalesQuery,
  useGetRolesPermissionsQuery,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';
import { copy } from '@/utils/copy';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTheme } from '@mui/material';
import { format } from 'date-fns';
import kebabCase from 'just-kebab-case';
import debounce from 'lodash.debounce';
import Image from 'next/image';
import type { RemoteAppUser } from 'pages/[workspaceSlug]/[appSlug]/users';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface EditUserFormProps extends DialogFormProps {
  /**
   * This is the selected user from the user's table.
   */
  user: RemoteAppUser;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: EditUserFormValues) => Promise<void>;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when banning the user.
   */
  onBanUser?: (user: RemoteAppUser) => Promise<void> | void;
  /**
   * Function to be called when deleting the user.
   */
  onDeleteUser: (user: RemoteAppUser) => Promise<void> | void;
  /**
   * User roles
   */
  roles: { [key: string]: boolean }[];
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
  metadata: Yup.string().test(
    'is-valid-json',
    'Metadata must be valid JSON or empty',
    (value) => {
      if (value === '') {
        return true;
      } // Allow empty string as valid input
      try {
        JSON.parse(value);
        return true;
      } catch (error) {
        return false;
      }
    },
  ),
});

export type EditUserFormValues = Yup.InferType<
  typeof EditUserFormValidationSchema
>;

export default function EditUserForm({
  location,
  user,
  onSubmit,
  onCancel,
  onDeleteUser,
  roles,
}: EditUserFormProps) {
  const theme = useTheme();
  const { onDirtyStateChange, openDialog } = useDialog();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isAnonymous = user.roles.some((role) => role.role === 'anonymous');
  const [isUserBanned, setIsUserBanned] = useState(user.disabled);
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
    refetchQueries: [RemoteAppGetUsersAndAuthRolesDocument],
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
      metadata: user?.metadata ? JSON.stringify(user.metadata, null, 2) : '',
    },
  });

  const {
    register,
    setError,
    clearErrors,
    formState: { errors, dirtyFields, isSubmitting, isValidating },
  } = form;

  const handleMetadataError = useMemo(() => {
    const debouncedSetError = debounce((value) => {
      try {
        JSON.parse(value);
        // Only set an error if JSON parsing fails
      } catch (error) {
        setError('metadata', {
          type: 'manual',
          message: 'Invalid JSON format',
        });
      }
    }, 500);

    return {
      call: debouncedSetError,
      cancel: debouncedSetError.cancel, // lodash debounce provides a cancel method to stop the delayed function
    };
  }, [setError]);

  const handleMetadataChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      if (value === '') {
        clearErrors('metadata'); // Clear errors when the input is explicitly cleared
        handleMetadataError.cancel(); // Cancel any debounced error checks
      } else {
        try {
          JSON.parse(value);
          clearErrors('metadata'); // Clear errors when valid JSON is entered
          handleMetadataError.cancel(); // Cancel pending debounced error checks
        } catch (error) {
          handleMetadataError.call(value); // Call the debounced error setter
        }
      }
    },
    [clearErrors, handleMetadataError],
  );

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  function handleChangeUserPassword() {
    openDialog({
      title: 'Change Password',
      component: <EditUserPasswordForm user={user} />,
    });
  }

  const { data: dataRoles } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
  });

  const allAvailableProjectRoles = getUserRoles(
    dataRoles?.config?.auth?.user?.roles?.allowed,
  );

  const { data } = useGetProjectLocalesQuery({
    variables: {
      appId: currentProject?.id,
    },
  });

  const allowedLocales = data?.config?.auth?.user?.locale?.allowed || [];

  /**
   * This will change the `disabled` field in the user to its opposite.
   * If the user is disabled, it will be enabled and vice versa.
   * We are tracking the `disabled` field as a react state variable in order to avoid
   * both having to refetch this single user from the database again or causing a re-render of the drawer.
   */
  async function handleUserDisabledStatus() {
    const shouldBan = !isUserBanned;

    const banUser = updateUser({
      variables: {
        id: user.id,
        user: {
          disabled: shouldBan,
        },
      },
    });

    await execPromiseWithErrorToast(() => banUser, {
      loadingMessage: shouldBan ? 'Banning user...' : 'Unbanning user...',
      successMessage: shouldBan
        ? 'User has been banned successfully.'
        : 'User has been unbanned successfully.',
      errorMessage: shouldBan
        ? 'An error occurred while trying to ban the user.'
        : 'An error occurred while trying to unban the user.',
    });
  }

  return (
    <FormProvider {...form}>
      <Form
        className="flex flex-col overflow-hidden border-t-1 lg:flex-auto lg:content-between"
        onSubmit={onSubmit}
      >
        <Box className="flex-auto divide-y overflow-y-auto">
          <Box
            component="section"
            className="grid grid-flow-col p-6 lg:grid-cols-7"
          >
            <div className="col-span-6 grid grid-flow-col place-content-start items-center gap-4">
              <Avatar className="h-12 w-12" src={user.avatarUrl} />
              <div className="grid grid-flow-row items-center">
                <Text className="text-lg font-medium">{user.displayName}</Text>
                <Text className="text-sm+ font-normal" color="secondary">
                  {user.email}
                </Text>
              </div>
              {isUserBanned && (
                <Chip
                  component="span"
                  color="error"
                  size="small"
                  label="Banned"
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
                <Dropdown.Content menu className="h-full w-full">
                  <Dropdown.Item
                    className="font-medium"
                    sx={{ color: 'error.main' }}
                    onClick={() => {
                      handleUserDisabledStatus();
                      setIsUserBanned((s) => !s);
                    }}
                  >
                    {isUserBanned ? 'Unban User' : 'Ban User'}
                  </Dropdown.Item>
                  <Dropdown.Item
                    className="font-medium"
                    sx={{ color: 'error.main' }}
                    onClick={() => {
                      onDeleteUser(user);
                    }}
                  >
                    Delete User
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Root>
            </div>
          </Box>
          <Box
            component="section"
            className="grid grid-flow-row grid-cols-4 gap-8 p-6"
          >
            <InputLabel as="h3" className="col-span-1 self-center">
              User ID
            </InputLabel>
            <div className="col-span-3 grid grid-flow-col items-center justify-start gap-2">
              <Text className="truncate font-medium">{user.id}</Text>
              <IconButton
                variant="borderless"
                color="secondary"
                aria-label="Copy User ID"
                onClick={(e) => {
                  e.stopPropagation();
                  copy(user.id, 'User ID');
                }}
              >
                <CopyIcon className="h-4 w-4" />
              </IconButton>
            </div>

            <InputLabel as="h3" className="col-span-1 self-center">
              Created At
            </InputLabel>
            <Text className="col-span-3 font-medium">
              {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm:ss')}
            </Text>

            <InputLabel as="h3" className="col-span-1 self-center">
              Last Seen
            </InputLabel>
            <Text className="col-span-3 font-medium">
              {user.lastSeen
                ? `${format(new Date(user.lastSeen), 'yyyy-MM-dd HH:mm:ss')}`
                : '-'}
            </Text>
          </Box>
          <Box component="section" className="grid grid-flow-row gap-8 p-6">
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
                    aria-label="Email Verified"
                  />
                )
              }
              fullWidth
              autoComplete="off"
            />

            <div className="col-span-1 my-1 grid grid-flow-col grid-cols-8 items-center">
              <div className="col-span-2">
                <InputLabel as="h3">Password</InputLabel>
              </div>
              <Button
                color="primary"
                variant="borderless"
                className="col-span-6 place-self-start px-2"
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
                    aria-label="Phone Number Verified"
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
              {allowedLocales.map((locale) => (
                <Option key={locale} value={locale}>
                  {locale}
                </Option>
              ))}
            </ControlledSelect>
          </Box>
          <Box
            component="section"
            className="grid place-content-start gap-4 p-6 lg:grid-cols-4"
          >
            <div className="col-span-1 items-center self-center align-middle">
              <InputLabel as="h3">OAuth Providers</InputLabel>
            </div>
            <div className="col-span-3 grid w-full grid-flow-row gap-y-6">
              {user.userProviders.length === 0 && (
                <div className="grid grid-flow-col place-content-between gap-x-1">
                  <Text className="font-normal" color="disabled">
                    This user has no OAuth providers connected.
                  </Text>
                </div>
              )}

              {user.userProviders.map((provider) => (
                <div
                  className="grid grid-flow-col place-content-between gap-3"
                  key={provider.id}
                >
                  <div className="span-cols-1 grid grid-flow-col gap-2">
                    <Image
                      src={
                        theme.palette.mode === 'dark'
                          ? `/assets/brands/light/${kebabCase(
                              provider.providerId,
                            )}.svg`
                          : `/assets/brands/${kebabCase(
                              provider.providerId,
                            )}.svg`
                      }
                      width={25}
                      height={25}
                      alt="Oauth provider logo"
                    />
                    <Text className="font-medium capitalize">
                      {getReadableProviderName(provider.providerId)}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Box>
          {!isAnonymous && (
            <Box
              component="section"
              className="grid grid-flow-row gap-y-10 p-6"
            >
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
              <div className="grid grid-flow-row place-content-start gap-6 lg:grid-flow-col lg:grid-cols-8">
                <InputLabel as="h3" className="col-span-2">
                  Allowed Roles
                </InputLabel>
                <div className="col-span-3 grid grid-flow-row gap-6">
                  {roles.map((role, i) => (
                    <ControlledCheckbox
                      id={`roles.${i}`}
                      label={Object.keys(role)[0]}
                      name={`roles.${i}`}
                      // eslint-disable-next-line react/no-array-index-key
                      key={`roles.${i}`}
                    />
                  ))}
                </div>
              </div>
            </Box>
          )}
          <Box component="section" className="grid grid-flow-row gap-8 p-6">
            <Input
              {...register('metadata', { onChange: handleMetadataChange })}
              id="metadata"
              label="Metadata"
              variant="inline"
              hideEmptyHelperText
              error={!!errors.metadata}
              fullWidth
              multiline
              inputProps={{
                className: 'resize-y min-h-[130px]',
              }}
              helperText={
                errors.metadata
                  ? errors.metadata.message
                  : 'Enter valid JSON. This can be a number, boolean, array, or object.'
              }
              maxRows={100}
              autoComplete="off"
            />
          </Box>
        </Box>

        <Box className="grid w-full flex-shrink-0 snap-end grid-flow-col justify-between gap-3 place-self-end border-t-1 p-2">
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
        </Box>
      </Form>
    </FormProvider>
  );
}
