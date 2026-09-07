import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import kebabCase from 'just-kebab-case';
import debounce from 'lodash.debounce';
import { ChevronDownIcon, CopyIcon } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { SelectItem } from '@/components/ui/v3/select';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { EditUserPasswordForm } from '@/features/orgs/projects/authentication/users/components/EditUserPasswordForm';
import { getReadableProviderName } from '@/features/orgs/projects/authentication/users/utils/getReadableProviderName';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  RemoteAppGetUsersAndAuthRolesDocument,
  useGetProjectLocalesQuery,
  useUpdateRemoteAppUserMutation,
} from '@/generated/graphql';
import type { RemoteAppUser } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/auth/users';
import { useThemePreference } from '@/providers/Theme';
import type { DialogFormProps } from '@/types/common';
import { copy } from '@/utils/copy';

export interface EditUserFormProps extends DialogFormProps {
  /**
   * This is the selected user from the user's table.
   */
  user: RemoteAppUser;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: EditUserFormValues) => Promise<void>;
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

const isValidMetadata = (value: string) => {
  if (value === '') {
    return true;
  }
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

export const EditUserFormValidationSchema = z.object({
  displayName: z.string().optional(),
  avatarURL: z.string().optional(),
  email: z
    .string()
    .min(1, 'This field is required.')
    .email('Invalid email address'),
  emailVerified: z.boolean().optional(),
  phoneNumber: z.string().nullable().optional(),
  phoneNumberVerified: z.boolean().optional(),
  locale: z.string().optional(),
  defaultRole: z.string().optional(),
  roles: z.array(z.boolean()).optional(),
  metadata: z
    .string()
    .refine(isValidMetadata, 'Metadata must be valid JSON or empty')
    .optional(),
});

export type EditUserFormValues = z.infer<typeof EditUserFormValidationSchema>;

export default function EditUserForm({
  location,
  user,
  onSubmit,
  onCancel,
  onDeleteUser,
  roles,
}: EditUserFormProps) {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { resolvedTheme } = useThemePreference();
  const { onDirtyStateChange, openDialog } = useDialog();
  const { project } = useProject();

  const [isUserBanned, setIsUserBanned] = useState(user.disabled);
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
    refetchQueries: [RemoteAppGetUsersAndAuthRolesDocument],
  });

  const form = useForm<EditUserFormValues>({
    reValidateMode: 'onSubmit',
    resolver: zodResolver(EditUserFormValidationSchema),
    defaultValues: {
      avatarURL: user.avatarUrl,
      displayName: user.displayName,
      email: user.email ?? '',
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber ?? null,
      phoneNumberVerified: user.phoneNumberVerified,
      locale: user.locale,
      defaultRole: user.defaultRole,
      roles: roles.map((role) => Object.values(role)[0]),
      metadata: user?.metadata ? JSON.stringify(user.metadata, null, 2) : '',
    },
  });

  const {
    setError,
    clearErrors,
    formState: { dirtyFields, isSubmitting, isValidating },
  } = form;

  const handleMetadataError = useMemo(() => {
    const debouncedSetError = debounce((value) => {
      try {
        JSON.parse(value);
        // Only set an error if JSON parsing fails
      } catch {
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
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      if (value === '') {
        clearErrors('metadata'); // Clear errors when the input is explicitly cleared
        handleMetadataError.cancel(); // Cancel any debounced error checks
      } else {
        try {
          JSON.parse(value);
          clearErrors('metadata'); // Clear errors when valid JSON is entered
          handleMetadataError.cancel(); // Cancel pending debounced error checks
        } catch {
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

  const { data } = useGetProjectLocalesQuery({
    variables: {
      appId: project?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
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
        <div className="flex-auto divide-y overflow-y-auto">
          <section className="grid grid-flow-col p-6 lg:grid-cols-7">
            <div className="col-span-6 grid grid-flow-col place-content-start items-center gap-4">
              <Avatar
                className="h-12 w-12"
                src={user.avatarUrl}
                alt={user.displayName ?? undefined}
                name={user.displayName ?? undefined}
              />
              <div className="grid grid-flow-row items-center">
                <p className="font-medium text-foreground text-lg">
                  {user.displayName}
                </p>
                <p className="font-normal text-muted-foreground text-sm+">
                  {user.email}
                </p>
              </div>
              {isUserBanned && <Badge variant="destructive">Banned</Badge>}
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger autoFocus={false} asChild>
                  <Button variant="outline" className="gap-2">
                    Actions
                    <ChevronDownIcon className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 p-0">
                  <DropdownMenuItem
                    className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                    onClick={() => {
                      handleUserDisabledStatus();
                      setIsUserBanned((s) => !s);
                    }}
                  >
                    {isUserBanned ? 'Unban User' : 'Ban User'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                    onClick={() => {
                      onDeleteUser(user);
                    }}
                  >
                    Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>
          <section className="grid grid-flow-row grid-cols-4 gap-8 p-6">
            <p className="col-span-1 self-center font-medium text-foreground text-sm leading-none">
              User ID
            </p>
            <div className="col-span-3 grid grid-flow-col items-center justify-start gap-2">
              <p className="truncate font-medium text-foreground">{user.id}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Copy User ID"
                onClick={(e) => {
                  e.stopPropagation();
                  copy(user.id, 'User ID');
                }}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>

            <p className="col-span-1 self-center font-medium text-foreground text-sm leading-none">
              Created At
            </p>
            <p className="col-span-3 font-medium text-foreground">
              {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm:ss')}
            </p>

            <p className="col-span-1 self-center font-medium text-foreground text-sm leading-none">
              Last Seen
            </p>
            <p className="col-span-3 font-medium text-foreground">
              {user.lastSeen
                ? `${format(new Date(user.lastSeen), 'yyyy-MM-dd HH:mm:ss')}`
                : '-'}
            </p>
          </section>
          <section className="grid grid-flow-row gap-8 p-6">
            <FormInput
              control={form.control}
              name="displayName"
              label="Display Name"
              placeholder="Enter Display Name"
              inline
              autoComplete="off"
            />
            <FormInput
              control={form.control}
              name="avatarURL"
              label="Avatar URL"
              placeholder="Enter Avatar URL"
              inline
              autoComplete="off"
            />
            <div className="grid gap-2">
              <FormInput
                control={form.control}
                name="email"
                label="Email"
                placeholder="Enter Email"
                inline
                autoComplete="off"
              />
              <div className="sm:pl-56">
                <FormCheckbox
                  control={form.control}
                  name="emailVerified"
                  label="Verified"
                  aria-label="Email Verified"
                />
              </div>
            </div>

            <div className="col-span-1 my-1 grid grid-flow-col grid-cols-8 items-center">
              <div className="col-span-2">
                <p className="font-medium text-foreground text-sm leading-none">
                  Password
                </p>
              </div>
              <Button
                variant="link"
                className="col-span-6 h-auto place-self-start px-2"
                onClick={handleChangeUserPassword}
              >
                Change
              </Button>
            </div>

            <div className="grid gap-2">
              <FormInput
                control={form.control}
                name="phoneNumber"
                label="Phone Number"
                placeholder="Enter Phone Number"
                inline
                autoComplete="off"
                transform={{
                  in: (value) => value ?? '',
                  out: (event) =>
                    event.target.value === '' ? null : event.target.value,
                }}
              />
              <div className="sm:pl-56">
                <FormCheckbox
                  control={form.control}
                  name="phoneNumberVerified"
                  label="Verified"
                  aria-label="Phone Number Verified"
                  disabled={!form.watch('phoneNumber')}
                />
              </div>
            </div>
            <FormSelect
              control={form.control}
              name="locale"
              inline
              label="Locale"
              containerClassName="truncate"
              className="truncate"
            >
              {allowedLocales.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {locale}
                </SelectItem>
              ))}
            </FormSelect>
          </section>
          <section className="grid place-content-start gap-4 p-6 lg:grid-cols-4">
            <div className="col-span-1 items-center self-center align-middle">
              <p className="font-medium text-foreground text-sm leading-none">
                OAuth Providers
              </p>
            </div>
            <div className="col-span-3 grid w-full grid-flow-row gap-y-6">
              {user.userProviders.length === 0 && (
                <div className="grid grid-flow-col place-content-between gap-x-1">
                  <p className="font-normal text-disabled">
                    This user has no OAuth providers connected.
                  </p>
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
                        resolvedTheme === 'dark'
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
                    <p className="font-medium text-foreground capitalize">
                      {getReadableProviderName(provider.providerId)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="grid grid-flow-row gap-y-10 p-6">
            <FormSelect
              control={form.control}
              name="defaultRole"
              inline
              label="Default Role"
              containerClassName="truncate"
              className="truncate"
            >
              {roles.map((role) => (
                <SelectItem
                  key={Object.keys(role)[0]}
                  value={Object.keys(role)[0]}
                >
                  {Object.keys(role)[0]}
                </SelectItem>
              ))}
            </FormSelect>
            <div className="grid grid-flow-row place-content-start gap-6 lg:grid-flow-col lg:grid-cols-8">
              <p className="col-span-2 font-medium text-foreground text-sm leading-none">
                Allowed Roles
              </p>
              <div className="col-span-3 grid grid-flow-row gap-6">
                {roles.map((role, i) => (
                  <FormCheckbox
                    control={form.control}
                    label={Object.keys(role)[0]}
                    name={`roles.${i}`}
                    key={Object.keys(role)[0]}
                  />
                ))}
              </div>
            </div>
          </section>
          <section className="grid grid-flow-row gap-8 p-6">
            <FormTextarea
              control={form.control}
              name="metadata"
              label="Metadata"
              inline
              className="min-h-[130px] resize-y"
              onChange={handleMetadataChange}
              helperText="Enter valid JSON. This can be a number, boolean, array, or object."
              autoComplete="off"
            />
          </section>
        </div>

        <div className="grid w-full flex-shrink-0 snap-end grid-flow-col justify-between gap-3 place-self-end border-t-1 p-2">
          <Button
            variant="outline"
            tabIndex={isDirty ? -1 : 0}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <ButtonWithLoading
            type="submit"
            className="justify-self-end"
            disabled={!isDirty}
            loading={isSubmitting || isValidating}
          >
            Save
          </ButtonWithLoading>
        </div>
      </Form>
    </FormProvider>
  );
}
