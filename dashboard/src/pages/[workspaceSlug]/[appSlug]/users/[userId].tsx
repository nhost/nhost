import ErrorMessage from '@/components/common/ErrorMessage';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import RemoveUserFromAppModal from '@/components/workspace/RemoveUserFromAppModal';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useFormSaver } from '@/hooks/useFormSaver';
import { Avatar } from '@/ui/Avatar';
import { FormSaver } from '@/ui/FormSaver';
import { Modal } from '@/ui/Modal';
import Status, { StatusEnum } from '@/ui/Status';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import IconButton from '@/ui/v2/IconButton';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';
import ChevronUpIcon from '@/ui/v2/icons/ChevronUpIcon';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import Text from '@/ui/v2/Text';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { copy } from '@/utils/copy';
import { triggerToast } from '@/utils/toast';
import type {
  GetRemoteAppUserAuthRolesFragment,
  GetRemoteAppUserFragment,
} from '@/utils/__generated__/graphql';
import {
  useDeleteRemoteAppUserRolesMutation,
  useGetRemoteAppUserQuery,
  useInsertRemoteAppUserRolesMutation,
  useRemoteAppDeleteUserMutation,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';
import { NhostApolloProvider } from '@nhost/react-apollo';
import bcrypt from 'bcryptjs';
import { format } from 'date-fns';
import router, { useRouter } from 'next/router';
import type { PropsWithChildren, ReactElement } from 'react';
import React, { useState } from 'react';

function UserSectionContainer({ title, children }: any) {
  return (
    <div className="mt-16 space-y-6">
      <Text variant="h3">{title}</Text>
      <div className="divide divide-y-1 border-t-1 border-b-1">{children}</div>
    </div>
  );
}

function UserDetailsFromAppElement({ title, children }: any) {
  return (
    <div className="grid grid-cols-8 items-center justify-between gap-4 px-2 py-3">
      <Text className="col-span-3 font-medium">{title}</Text>

      <div className="col-span-5">{children}</div>
    </div>
  );
}

type UserDetailsFromAppProps = {
  user: GetRemoteAppUserFragment;
};

function UserDetailsFromApp({ user }: UserDetailsFromAppProps) {
  return (
    <div className="divide-y-1 divide-divide">
      <UserDetailsFromAppElement title="User ID">
        <div className="grid grid-flow-col items-center justify-start gap-2">
          <Text className="font-medium">{user.id}</Text>

          <IconButton
            variant="borderless"
            color="secondary"
            onClick={() => copy(user.id, 'User ID')}
            aria-label="Copy user ID"
            className="p-1"
          >
            <CopyIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </UserDetailsFromAppElement>
      <UserDetailsFromAppElement title="Status">
        <div className="flex flex-row space-x-2 self-center">
          {user.disabled && (
            <Status status={StatusEnum.Closed}>Disabled</Status>
          )}
          {user.emailVerified || user.phoneNumberVerified ? (
            <Status status={StatusEnum.Live}>Verified</Status>
          ) : (
            <Status status={StatusEnum.Medium}>Unverified</Status>
          )}
        </div>
      </UserDetailsFromAppElement>
      <UserDetailsFromAppElement title="Created">
        <Text className="font-medium">
          {format(new Date(user.createdAt), 'dd MMM yyyy')}
        </Text>
      </UserDetailsFromAppElement>
    </div>
  );
}

function UserDetailsSection({ children }: PropsWithChildren<unknown>) {
  return (
    <UserSectionContainer title="Details">{children}</UserSectionContainer>
  );
}

type UserDetailsPasswordProps = {
  userId: string;
  userHasPasswordSet?: boolean;
};

function UserDetailsPassword({
  userId,
  userHasPasswordSet,
}: UserDetailsPasswordProps) {
  const [password, setPassword] = useState('');
  const [editPassword, setEditPassword] = useState(false);

  const [updateUser, { loading }] = useUpdateRemoteAppUserMutation();
  const [error, setError] = useState('');

  const handleOnSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      await updateUser({
        variables: {
          id: userId,
          user: {
            passwordHash,
          },
        },
      });
    } catch (hashError) {
      if (hashError instanceof Error) {
        setError(hashError.message);
      }

      setError(hashError);
    }

    triggerToast('The password was successfully changed');
    setEditPassword(false);
    setPassword('');
  };

  if (editPassword) {
    return (
      <form
        onSubmit={handleOnSubmit}
        className="flex w-full flex-row items-start gap-2 py-3 px-2"
      >
        <Input
          id="password"
          label="Password"
          name="Password"
          placeholder={userHasPasswordSet ? `••••••••••••` : 'Password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          fullWidth
          hideEmptyHelperText
          helperText={error || ''}
          error={!!error}
          variant="inline"
          inlineInputProportion="66%"
          slotProps={{
            label: { className: 'text-sm+ font-medium' },
            inputWrapper: { className: 'max-w-[370px] justify-self-end' },
          }}
          className="justify-self-stretch"
        />

        <Button
          type="submit"
          loading={loading}
          className="justify-self-end py-2"
        >
          Save
        </Button>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-8 items-center gap-4 py-3 px-2">
      <Text className="col-span-3 text-sm+ font-medium">Password</Text>
      <div className="col-span-5 grid w-full grid-flow-col place-content-between items-center gap-2">
        <Text variant="subtitle2">
          {userHasPasswordSet ? `••••••••••••` : 'No password set'}
        </Text>

        <Button variant="borderless" onClick={() => setEditPassword(true)}>
          Change
        </Button>
      </div>
    </div>
  );
}

type UserDetailsProps = {
  user: GetRemoteAppUserFragment;
  authRoles: GetRemoteAppUserAuthRolesFragment[];
};

function UserDetails({ user: externalUser, authRoles }: UserDetailsProps) {
  const {
    query: { workspaceSlug, appSlug },
  } = useRouter();

  const { showFormSaver, setShowFormSaver, submitState, setSubmitState } =
    useFormSaver();

  const [originalUser, setOriginalUser] = useState(externalUser);
  const [user, setUser] = useState(externalUser);

  const stateUserRoles = originalUser.roles.map((role) => role.role);
  const [roles, setRoles] = useState(stateUserRoles);

  const defaultRoleOptions = authRoles.map((role) => ({
    id: role.role,
    name: role.role,
    disabled: false,
  }));

  const [updateUser] = useUpdateRemoteAppUserMutation();
  const [insertUserRoles] = useInsertRemoteAppUserRolesMutation();
  const [deleteUserRoles] = useDeleteRemoteAppUserRolesMutation();

  const [deleteUser, { loading: deleteUserLoading }] =
    useRemoteAppDeleteUserMutation();

  const handleFormSubmit = async () => {
    setSubmitState({
      loading: true,
      error: null,
    });

    try {
      await updateUser({
        variables: {
          id: user.id,
          user: {
            displayName: user.displayName,
            email: user.email,
            defaultRole: user.defaultRole,
          },
        },
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error,
      });

      return;
    }
    // role di
    const addedAllowedRoles = roles.filter(
      (role) => !stateUserRoles.includes(role),
    );
    const deletedAllowedRoles = stateUserRoles.filter(
      (role) => !roles.includes(role),
    );

    try {
      await insertUserRoles({
        variables: {
          roles: addedAllowedRoles.map((role) => ({
            userId: user.id,
            role,
          })),
        },
      });
      await deleteUserRoles({
        variables: {
          userId: user.id,
          roles: deletedAllowedRoles,
        },
      });
    } catch (error) {
      setSubmitState({
        loading: false,
        error,
      });

      return;
    }

    setOriginalUser(user);

    setSubmitState({
      loading: false,
      error: null,
    });

    triggerToast('Settings saved');
    setShowFormSaver(false);
  };

  const [removeUserFromAppModal, setRemoveUserFromAppModal] = useState(false);

  const handleDeleteUser = async () => {
    await deleteUser({
      variables: {
        id: user.id,
      },
    });
    triggerToast(`${user.displayName} deleted`);
    router.push(`/${workspaceSlug}/${appSlug}/users`);
  };

  const [toggleShowRoles, setToggleShowRoles] = useState(false);

  return (
    <Container className="max-w-3xl">
      {showFormSaver && (
        <FormSaver
          show={showFormSaver}
          onCancel={() => {
            setUser(originalUser);
            setShowFormSaver(false);
          }}
          onSave={() => {
            handleFormSubmit();
          }}
          loading={submitState.loading}
        />
      )}
      <Modal
        showModal={removeUserFromAppModal}
        close={() => setRemoveUserFromAppModal(false)}
      >
        <RemoveUserFromAppModal
          onClick={handleDeleteUser}
          close={() => setRemoveUserFromAppModal(!removeUserFromAppModal)}
        />
      </Modal>
      <div className="flex flex-row">
        <Avatar
          className="h-14 w-14 rounded-lg"
          avatarUrl={user.avatarUrl}
          name={user.displayName}
        />
        <div className="ml-4 flex flex-col self-center">
          <Text variant="h3" component="h1">
            {user.displayName || user.phoneNumber}
          </Text>
          <Text variant="subtitle2" className="!text-greyscaleGrey">
            {user.id}
          </Text>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <Input
          value={user.displayName}
          id="displayName"
          label="Display Name"
          fullWidth
          placeholder="Display Name"
          variant="inline"
          inlineInputProportion="66%"
          hideEmptyHelperText
          onChange={(event) => {
            setShowFormSaver(true);
            setUser({
              ...user,
              displayName: event.target.value,
            });
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }

            handleFormSubmit();
          }}
          slotProps={{
            label: { className: 'text-sm+ font-medium' },
          }}
        />

        <Input
          value={user.email}
          id="email"
          label="Email"
          placeholder="Email"
          variant="inline"
          inlineInputProportion="66%"
          hideEmptyHelperText
          fullWidth
          autoComplete="off"
          onChange={(event) => {
            setShowFormSaver(true);
            setUser({
              ...user,
              email: event.target.value,
            });
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }

            handleFormSubmit();
          }}
          slotProps={{
            label: { className: 'text-sm+ font-medium' },
          }}
        />

        <Select
          value="EN"
          id="locale"
          label="Locale"
          variant="inline"
          inlineInputProportion="66%"
          fullWidth
          hideEmptyHelperText
          slotProps={{
            label: { className: 'text-sm+ font-medium' },
          }}
        >
          <Option value="EN">English</Option>
        </Select>
      </div>

      <UserDetailsSection>
        <UserDetailsFromApp user={originalUser} />
      </UserDetailsSection>
      <UserSectionContainer title="Sign-In Methods">
        <UserDetailsPassword
          userId={user.id}
          userHasPasswordSet={!!user.passwordHash}
        />

        <UserDetailsFromAppElement title="Authentication">
          <div className="flex w-full flex-col space-y-3">
            <div className="flex place-content-between items-center">
              <div className="flex">
                <Text className="font-medium">Email + Password</Text>
              </div>
              <div className="flex">
                <Status
                  status={
                    user.email && user.passwordHash
                      ? StatusEnum.Live
                      : StatusEnum.Closed
                  }
                >
                  {user.email && user.passwordHash ? 'Active' : 'Inactive'}
                </Status>
              </div>
            </div>
            <div className="flex place-content-between items-center">
              <div className="flex">
                <Text className="font-medium">Magic Link</Text>
              </div>
              <div className="flex">
                <Status
                  status={user.email ? StatusEnum.Live : StatusEnum.Closed}
                >
                  {user.email && user.passwordHash ? 'Active' : 'Inactive'}
                </Status>
              </div>
            </div>
            <div className="flex place-content-between items-center">
              <div className="flex">
                <Text className="font-medium">SMS</Text>
              </div>
              <div className="flex">
                <Status
                  status={
                    user.phoneNumber ? StatusEnum.Live : StatusEnum.Closed
                  }
                >
                  {user.phoneNumber ? 'Active' : 'Inactive'}
                </Status>
              </div>
            </div>
          </div>
        </UserDetailsFromAppElement>
      </UserSectionContainer>

      {toggleShowRoles && (
        <UserSectionContainer title="Roles">
          <div className="px-2 py-3">
            <Select
              label="Default role in API requests"
              id="defaultRole"
              fullWidth
              value={user.defaultRole}
              variant="inline"
              inlineInputProportion="66%"
              aria-label="Default role"
              hideEmptyHelperText
              onChange={(_event, value) => {
                setShowFormSaver(true);

                setUser({
                  ...user,
                  defaultRole: value as string,
                });
              }}
              slotProps={{
                label: { className: 'text-sm+ font-medium' },
              }}
            >
              {defaultRoleOptions.map((role) => (
                <Option value={role.id} key={role.id}>
                  {role.name}
                </Option>
              ))}
            </Select>
          </div>
          <UserDetailsFromAppElement title="Roles">
            <div className="grid w-full grid-flow-row gap-4">
              {authRoles.map((role) => {
                const checked = roles.includes(role.role);

                return (
                  <Checkbox
                    label={role.role}
                    componentsProps={{
                      formControlLabel: {
                        componentsProps: {
                          typography: { className: 'text-sm+' },
                        },
                      },
                    }}
                    checked={checked}
                    onChange={(_event, isChecked) => {
                      setShowFormSaver(true);

                      if (!isChecked) {
                        const index = roles.indexOf(role.role);

                        if (index === -1) {
                          return;
                        }

                        roles.splice(index, 1);
                        setRoles([...roles]);

                        return;
                      }

                      setRoles([...roles, role.role]);
                    }}
                    key={role.role}
                  />
                );
              })}
            </div>
          </UserDetailsFromAppElement>
        </UserSectionContainer>
      )}
      <div className="mt-3 flex flex-row place-content-between px-1">
        <Button
          startIcon={toggleShowRoles ? <ChevronUpIcon /> : <ChevronDownIcon />}
          variant="borderless"
          onClick={() => setToggleShowRoles(!toggleShowRoles)}
        >
          {toggleShowRoles ? 'Hide Roles' : 'Show Roles'}
        </Button>

        <Button
          variant="borderless"
          color="error"
          onClick={() => setRemoveUserFromAppModal(true)}
          loading={deleteUserLoading}
        >
          Delete User
        </Button>
      </div>
    </Container>
  );
}

function UserDetailsPreloadData() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const {
    query: { userId },
  } = useRouter();

  const { data, loading } = useGetRemoteAppUserQuery({
    variables: {
      id: userId,
    },
    skip:
      !currentApplication?.subdomain &&
      !currentApplication?.hasuraGraphqlAdminSecret,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!data?.user) {
    return (
      <Container>
        <ErrorMessage>
          User data is not available. Please try again later.
        </ErrorMessage>
      </Container>
    );
  }

  const { user, authRoles } = data;

  return <UserDetails user={user} authRoles={authRoles} />;
}

export default function UserDetailsByIdPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  if (
    !currentApplication?.subdomain ||
    !currentApplication?.hasuraGraphqlAdminSecret
  ) {
    return <LoadingScreen />;
  }

  return (
    <NhostApolloProvider
      graphqlUrl={generateAppServiceUrl(
        currentApplication.subdomain,
        currentApplication.region.awsName,
        'graphql',
      )}
      fetchPolicy="cache-first"
      headers={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : currentApplication.hasuraGraphqlAdminSecret,
      }}
    >
      <UserDetailsPreloadData />
    </NhostApolloProvider>
  );
}

UserDetailsByIdPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
