import type { GetRolesQuery } from '@/generated/graphql';
import {
  refetchGetRolesQuery,
  useGetRolesQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import Loading from '@/ui/Loading';
import { Modal } from '@/ui/Modal';
import { Text } from '@/ui/Text';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import type {
  CreateUserRoleBaseFormData,
  CreateUserRoleModalBaseProps,
} from './CreateUserRoleModalBase';
import { CreateUserRoleModalBase } from './CreateUserRoleModalBase';

export type EditUserRoleFormData = CreateUserRoleBaseFormData;

export type EditUserRoleModalProps = Pick<
  CreateUserRoleModalBaseProps,
  'onClose'
> & {
  /**
   * The permission variable to edit.
   */
  payload: any;
};

export function EditUserRoleModal({
  payload: originalRole,
  ...props
}: EditUserRoleModalProps) {
  const [error, setError] = useState<Error>();
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const form = useForm<EditUserRoleFormData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      roleName: originalRole.name || '',
    },
  });

  const [updateApp, { loading: loadingUpdateAppMutation }] =
    useUpdateAppMutation({
      refetchQueries: [refetchGetRolesQuery({ id: currentApplication.id })],
    });

  const {
    data: currentRolesData,
    loading,
    error: getRolesError,
  } = useGetRolesQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  if (loading) {
    return <Loading />;
  }

  if (getRolesError) {
    return (
      <div className="mx-auto max-w-2.5xl">
        <Alert severity="error">{error.message}</Alert>
      </div>
    );
  }

  async function handleSubmit(data: EditUserRoleFormData) {
    setError(undefined);

    const currentUserRoles =
      currentRolesData.app.authUserDefaultAllowedRoles.split(',');

    const roleBeingEdited = currentUserRoles.find(
      (role) => role === originalRole.name,
    );

    const indexofRoleBeingEdited = currentUserRoles.indexOf(roleBeingEdited);
    const newRoleName = data.roleName;

    const newAuthUserDefaultAllowedRoles = currentUserRoles.slice();

    if (data.roleName !== originalRole.name) {
      newAuthUserDefaultAllowedRoles[indexofRoleBeingEdited] = newRoleName;
    }

    try {
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authUserDefaultAllowedRoles:
              newAuthUserDefaultAllowedRoles.join(','),
          },
        },
      });
      triggerToast(`Role "${data.roleName}" updated successfully`);
      props.onClose();
    } catch (updateError) {
      setError(updateError);
    }
  }

  async function handleRemove(data: GetRolesQuery) {
    setError(undefined);

    // Get the current roles of this application.
    const currentUserRoles = data.app.authUserDefaultAllowedRoles.split(',');

    // Remove the role from the current roles.
    const filteredCurrentUserRoles = currentUserRoles.filter(
      (role) => role !== originalRole.name,
    );

    const newAuthUserDefaultAllowedRoles = filteredCurrentUserRoles.join(',');

    try {
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authUserDefaultAllowedRoles: newAuthUserDefaultAllowedRoles,
          },
        },
      });
      props.onClose();
      triggerToast(`Role "${originalRole.name}" removed successfully`);
    } catch (updateError) {
      setError(updateError);
    }
  }

  return (
    <>
      <Modal
        showModal={showRemoveModal}
        close={() => setShowRemoveModal(false)}
      >
        <div className="px-6 pt-5 text-center text-greyscaleDark">
          <Text variant="heading" className="mb-2 text-lg font-medium">
            Remove Role &quot;{originalRole.name}&quot;?
          </Text>

          <div className="my-4">
            <Button
              variant="danger"
              onClick={() => handleRemove(currentRolesData)}
              className="w-full"
              loading={loadingUpdateAppMutation}
            >
              Remove Role
            </Button>

            <Button
              onClick={() => setShowRemoveModal(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <FormProvider {...form}>
        <CreateUserRoleModalBase
          title="Edit Role"
          type="edit"
          onSubmit={handleSubmit}
          onRemove={() => setShowRemoveModal(true)}
          errorComponent={
            error && (
              <Alert className="mt-4" severity="error">
                {error.message}
              </Alert>
            )
          }
          {...props}
        />
      </FormProvider>
    </>
  );
}
