import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import ControlledSelect from '@/components/common/ControlledSelect';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import { useGetRolesQuery } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import Chip from '@/ui/v2/Chip';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import InputLabel from '@/ui/v2/InputLabel';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import getUserRoles from '@/utils/settings/getUserRoles';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { Avatar } from '@mui/material';
import { format, formatRelative } from 'date-fns';
import Image from 'next/image';
import type { RemoteAppUser } from 'pages/[workspaceSlug]/[appSlug]/users';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

export interface EditUserFormProps {
  //  * The selected user.
  //  */
  user: RemoteAppGetUsersQuery['users'][0];
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
   * Function to be called when the operation is cancelled.
   */
  onBanUser: (user: RemoteAppUser) => Promise<void>;
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
  roles: Yup.array().of(Yup.bool()),
});

export type EditUserFormValues = Yup.InferType<
  typeof EditUserFormValidationSchema
>;

export default function EditUserForm({
  user,
  onEditUser,
  onCancel,
  onBanUser,
}: EditUserFormProps) {
  const { onDirtyStateChange, openDialog, openAlertDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data } = useGetRolesQuery({
    variables: { id: currentApplication.id },
    fetchPolicy: 'cache-only',
  });

  const allAvailableProjectRoles = useMemo(
    () => getUserRoles(data?.app?.authUserDefaultAllowedRoles),
    [data],
  );

  const isAnonymous = user.roles.some((role) => role.role === 'anonymous');

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
      roles: allAvailableProjectRoles?.map((role) => {
        const userRole = user.roles.find((sr) => sr.role === role.name);
        return !!userRole;
      }),
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

  useEffect(() => {
    form.reset(() => ({
      avatarURL: user.avatarUrl,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      locale: user.locale,
      defaultRole: user.defaultRole,
      roles: allAvailableProjectRoles?.map((role) => {
        const userRole = user.roles.find((sr) => sr.role === role.name);
        return !!userRole;
      }),
    }));
  }, [user, form, allAvailableProjectRoles]);

  function handleChangeUserPassword() {
    openDialog('EDIT_USER_PASSWORD', {
      title: 'Change Password',
      payload: { user },
      props: {
        titleProps: { className: 'mx-auto' },
        PaperProps: { className: 'max-w-md' },
      },
    });
  }

  const signInMethodsAvailable = user.email || user.userProviders.length !== 0;

  return (
    <FormProvider {...form}>
      <Form
        className="divide-y border-y"
        onSubmit={(values) => {
          onEditUser(values, user);
        }}
      >
        <section className="grid grid-flow-col grid-cols-7 p-6">
          <div className="grid items-center grid-flow-col col-span-6 gap-4 place-content-start">
            {!user.avatarUrl.includes('default=blank') ? (
              <Avatar className="w-12 h-12" src={user.avatarUrl} />
            ) : (
              <Avatar className="relative inline-flex items-center justify-center w-12 h-12 overflow-hidden bg-gray-300 rounded-full">
                <span className="text-xs font-medium text-gray-600 uppercase">
                  {user.displayName.slice(0, 2)}
                </span>
              </Avatar>
            )}

            <div className="grid items-center grid-flow-row">
              <Text className="text-lg font-medium">{user.displayName}</Text>
              <Text className="font-normal text-sm+ text-greyscaleGreyDark">
                {user.email}
              </Text>
            </div>
            {user.disabled && (
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
            <Select placeholder="Actions" hideEmptyHelperText>
              <Option
                value="Actions"
                className="text-sm+ font-medium text-red"
                onClick={() => {
                  onBanUser(user);
                }}
              >
                {user.disabled ? 'Unban User' : 'Ban User'}
              </Option>
              <Option
                value="Actions"
                className="text-sm+ font-medium text-red"
                onClick={() => {
                  openAlertDialog({
                    title: 'Delete User',
                    payload: (
                      <Text>
                        Are you sure you want to delete the &quot;
                        <strong>{user.displayName}</strong>&quot; user?
                        <br /> This cannot be undone.
                      </Text>
                    ),
                    props: {
                      primaryButtonColor: 'error',
                      primaryButtonText: 'Delete',
                      titleProps: { className: 'mx-auto' },
                      PaperProps: { className: 'max-w-lg mx-auto' },
                    },
                  });
                }}
              >
                Delete User
              </Option>
            </Select>
          </div>
        </section>
        <section className="grid grid-flow-row grid-cols-4 gap-8 p-6">
          <InputLabel as="h3" className="col-span-1">
            User ID
          </InputLabel>
          <Text className="col-span-3 font-medium">
            {user.id}
            <IconButton
              color="secondary"
              variant="borderless"
              className="ml-1"
              onClick={(e) => {
                e.stopPropagation();
                copy(user.id, 'User ID');
              }}
            >
              <CopyIcon className="w-4 h-4" />
            </IconButton>
          </Text>

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
            {user.lastSeen
              ? formatRelative(new Date(), new Date(user.lastSeen))
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
            <Option value="en">English</Option>
            <Option value="fr">French</Option>
          </ControlledSelect>
        </section>
        {signInMethodsAvailable && (
          <section className="grid grid-cols-4 p-6 place-content-start">
            <div className="col-span-1">
              <InputLabel as="h3">Sign-In Methods</InputLabel>
            </div>
            <div className="grid w-full grid-flow-row col-span-2 gap-y-6">
              {/* Email based sign-ups are not included in users.providers, we need to render it based on the existence of the user's email */}
              {user.email && (
                <div className="grid grid-flow-col gap-x-1 place-content-between">
                  <div className="grid grid-flow-col gap-3 span-cols-1">
                    <Image src="/assets/Envelope.svg" width={25} height={25} />
                    <Text className="font-medium">Email + Password</Text>
                  </div>

                  <Chip
                    component="span"
                    color="success"
                    size="small"
                    label="Active"
                  />
                </div>
              )}

              {user.userProviders.map((provider) => (
                <div className="grid grid-flow-col gap-3 place-content-between">
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
                      {provider.providerId}
                    </Text>
                  </div>

                  <Chip
                    component="span"
                    color="success"
                    size="small"
                    label="Active"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
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
                <Option value={role.name}>{role.name}</Option>
              ))}
            </ControlledSelect>
            <div className="grid grid-flow-col grid-cols-8 gap-6 place-content-start">
              <InputLabel as="h3" className="col-span-2">
                Allowed Roles
              </InputLabel>
              <div className="grid grid-flow-row col-span-3 gap-6">
                {allAvailableProjectRoles.map((role) => (
                  <Checkbox
                    {...register(
                      `roles.${allAvailableProjectRoles?.indexOf(role)}`,
                    )}
                    disabled={role.isSystemRole}
                    label={role.name}
                    key={role.name}
                    defaultChecked={
                      form.getValues()?.roles[
                        allAvailableProjectRoles.indexOf(role)
                      ]
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <div
          className={twMerge(
            'grid justify-between flex-shrink-0 w-full grid-flow-col gap-3 p-2 border-gray-200 place-self-end border-t-1 snap-end',
            isAnonymous && 'absolute bottom-0',
          )}
        >
          <Button
            variant="outlined"
            color="secondary"
            tabIndex={isDirty ? -1 : 0}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button type="submit" className="justify-self-end">
            Save
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
