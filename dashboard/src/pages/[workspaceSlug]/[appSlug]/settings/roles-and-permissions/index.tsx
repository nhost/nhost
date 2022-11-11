import CreatePermissionVariableModal from '@/components/applications/users/permissions/modal/CreatePermissionVariableModal';
import EditPermissionVariableModal from '@/components/applications/users/permissions/modal/EditPermissionVariableModal';
import { PermissionSetting } from '@/components/applications/users/PermissionSetting';
import { RolesTable } from '@/components/applications/users/RolesTable';
import { SettingsSection } from '@/components/applications/users/SettingsSection';
import ErrorBoundaryFallback from '@/components/common/ErrorBoundaryFallback';
import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import useCustomClaims from '@/hooks/useCustomClaims';
import { useSubmitState } from '@/hooks/useSubmitState';
import type { CustomClaim } from '@/types/application';
import { Alert } from '@/ui/Alert';
import Loading from '@/ui/Loading';
import { Modal } from '@/ui/Modal';
import { Text } from '@/ui/Text';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import {
  useGetRolesQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useApolloClient } from '@apollo/client';
import { ChevronRightIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import Link from 'next/link';
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import toast from 'react-hot-toast';

type ModalState = {
  visible: boolean;
  type: 'create' | 'edit';
  payload: CustomClaim;
};

type ModalAction = {
  type: 'OPEN_CREATE_MODAL' | 'OPEN_EDIT_MODAL' | 'CLOSE_MODAL';
  payload?: CustomClaim;
};

function modalStateReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_CREATE_MODAL':
      return { ...state, visible: true, type: 'create', payload: null };
    case 'OPEN_EDIT_MODAL':
      return { ...state, visible: true, type: 'edit', payload: action.payload };
    case 'CLOSE_MODAL':
      return { ...state, visible: false };
    default:
      throw new Error(`Action type ${action.type} is not supported.`);
  }
}

function PermissionVariablesTable({ appId }: any) {
  const [
    { visible: modalVisible, type: modalType, payload: modalPayload },
    dispatch,
  ] = useReducer(modalStateReducer, {
    visible: false,
    type: null,
    payload: null,
  });

  const { data: customClaims, loading, error } = useCustomClaims({ appId });

  if (loading) {
    return <Loading />;
  }

  if (error) {
    throw error;
  }

  function handlePermissionSelect(
    event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>,
    claim: CustomClaim,
  ) {
    if ('key' in event && event.key !== 'Enter') {
      return;
    }

    dispatch({ type: 'OPEN_EDIT_MODAL', payload: claim });
  }

  return (
    <>
      <Modal
        showModal={modalVisible}
        close={() => dispatch({ type: 'CLOSE_MODAL' })}
      >
        {modalType === 'create' ? (
          <CreatePermissionVariableModal
            onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
          />
        ) : (
          <EditPermissionVariableModal
            onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
            payload={modalPayload}
          />
        )}
      </Modal>

      <table className="w-full overflow-x-auto table-fixed">
        <thead>
          <tr>
            <th className="p-2 text-left w-60">
              <Text className="text-xs font-bold text-greyscaleDark">
                Field name
              </Text>
            </th>
            <th className="w-full p-2 text-left">
              <Text className="text-xs font-bold text-greyscaleDark">Path</Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {customClaims.map((claim, index) => (
            <tr
              role={claim.system ? undefined : 'button'}
              tabIndex={claim.system ? undefined : 0}
              onClick={
                claim.system
                  ? undefined
                  : (event) => handlePermissionSelect(event, claim)
              }
              onKeyDown={
                claim.system
                  ? undefined
                  : (event) => handlePermissionSelect(event, claim)
              }
              aria-label={claim.key}
              className="border-gray-300 border-solid border-t-1"
              key={claim.key || index}
            >
              <td className="p-2">
                <Text
                  className={clsx(
                    claim.system ? 'text-greyscaleGrey' : 'text-greyscaleDark',
                    'text-sm+ font-medium',
                  )}
                >
                  X-Hasura-{claim.key}
                </Text>
              </td>
              <td className="flex items-center justify-between p-2">
                <Text
                  className={clsx(
                    claim.system ? 'text-greyscaleGrey' : 'text-greyscaleDark',
                    'text-sm+',
                  )}
                >
                  user.{claim.value}
                </Text>

                {claim.system ? (
                  <Text className="text-sm+ font-medium uppercase tracking-wide text-greyscaleGrey">
                    System
                  </Text>
                ) : (
                  <ChevronRightIcon className="h-4.5 w-4.5 text-greyscaleDark" />
                )}
              </td>
            </tr>
          ))}

          <tr className="border-gray-300 border-solid border-y-1">
            <td className="p-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'OPEN_CREATE_MODAL' })}
              >
                <Text className="text-sm+ font-medium text-blue">
                  New Permission Variable
                </Text>
              </button>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </>
  );
}

function UserRoles() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetRolesQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2.5xl">
        <Alert severity="error">{error.message}</Alert>
      </div>
    );
  }

  return (
    <SettingsSection
      title="Default Allowed Roles"
      wrapperProps={{
        className: 'mt-12 mb-32',
      }}
    >
      <RolesTable data={data} />
    </SettingsSection>
  );
}

function DefaultRoleInAPIRequests() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const toastId = useRef(null);

  const { data, loading, error } = useGetRolesQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  const [currentDefaultRole, setCurrentDefaultRole] = useState({
    id: 'user',
    name: 'user',
    disabled: false,
    slug: 'user',
  });

  const [currentAvailableRoles, setCurrentAvailableRoles] = useState([
    {
      id: 'user',
      name: 'user',
      disabled: false,
      slug: 'user',
    },
  ]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setCurrentDefaultRole({
      disabled: false,
      id: data.app.authUserDefaultRole,
      slug: data.app.authUserDefaultRole,
      name: data.app.authUserDefaultRole,
    });

    setCurrentAvailableRoles(
      data.app.authUserDefaultAllowedRoles.split(',').map((role) => ({
        disabled: false,
        id: role,
        slug: role,
        name: role,
      })),
    );
  }, [data]);

  const { submitState, setSubmitState } = useSubmitState();

  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2.5xl">
        <Alert severity="error">{error.message}</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col mt-2 border-t border-b divide-y-1 divide-divide">
      {submitState.error && (
        <Alert severity="error">{submitState.error.message}</Alert>
      )}
      <PermissionSetting
        text="Default Role"
        options={currentAvailableRoles}
        value={currentDefaultRole}
        onChange={async (v: { id: string }) => {
          try {
            toastId.current = showLoadingToast('Changing default role');
            await updateApp({
              variables: {
                id: currentApplication.id,
                app: {
                  authUserDefaultRole: v.id,
                },
              },
            });
            await client.refetchQueries({
              include: ['getRoles'],
            });
            toast.remove(toastId.current);
            triggerToast(
              `Successfully changed default role to: ${currentApplication.name}`,
            );
          } catch (appUpdateError) {
            if (toastId) {
              toast.remove(toastId.current);
            }

            if (appUpdateError instanceof Error) {
              triggerToast(appUpdateError.message);
            }

            setSubmitState({
              loading: false,
              error: appUpdateError,
              fieldsWithError: ['authUserDefaultRole'],
            });
          }
        }}
      />
    </div>
  );
}

export default function UsersRolesPage() {
  const { workspaceContext } = useWorkspaceContext();

  return (
    <Container>
      <SettingsSection
        title="Roles"
        wrapperProps={{
          className: 'mt-0 mb-20',
        }}
      >
        <DefaultRoleInAPIRequests />
      </SettingsSection>

      <UserRoles />

      <SettingsSection
        title={<span>Permission Variables</span>}
        titleProps={{
          className:
            'grid gap-2 grid-flow-col items-center place-content-start',
        }}
        desc={
          <p>
            These variables can be used to defined permissions. They are sent
            from client to the GraphQL API, and must match the specified
            property of a queried user.{' '}
            <Link
              href="https://docs.nhost.io/platform/graphql/permissions"
              passHref
            >
              <Text
                variant="a"
                className="font-medium text-blue"
                rel="noopener noreferrer"
                target="_blank"
              >
                Read More
              </Text>
            </Link>
          </p>
        }
      >
        <ErrorBoundary fallbackRender={ErrorBoundaryFallback}>
          <PermissionVariablesTable appId={workspaceContext.appId} />
        </ErrorBoundary>
      </SettingsSection>
    </Container>
  );
}

UsersRolesPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
