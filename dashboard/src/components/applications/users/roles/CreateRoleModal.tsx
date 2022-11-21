import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Loading from '@/ui/Loading';
import {
  refetchGetRolesQuery,
  useGetRolesQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import type {
  CreateUserRoleBaseFormData,
  CreateUserRoleModalBaseProps,
} from './CreateUserRoleModalBase';
import { CreateUserRoleModalBase } from './CreateUserRoleModalBase';

export type CreateUserRoleFormData = CreateUserRoleBaseFormData;

export type CreateUserRoleModalProps = Pick<
  CreateUserRoleModalBaseProps,
  'onClose'
>;

export function CreateUserRoleModal({ onClose }: CreateUserRoleModalProps) {
  const [error, setError] = useState<Error>();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const form = useForm<CreateUserRoleBaseFormData>({
    reValidateMode: 'onSubmit',
  });

  const [updateApp] = useUpdateAppMutation({
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

  async function handleSubmit(data) {
    setError(undefined);

    const newAuthUserDefaultAllowedRoles = `${currentRolesData.app.authUserDefaultAllowedRoles},${data.roleName}`;

    try {
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authUserDefaultAllowedRoles: newAuthUserDefaultAllowedRoles,
          },
        },
      });

      if (!onClose) {
        return;
      }

      onClose();
    } catch (updateError) {
      setError(updateError);
    }
  }

  return (
    <FormProvider {...form}>
      <CreateUserRoleModalBase
        title="Create New Role"
        type="create"
        onSubmit={handleSubmit}
        onClose={onClose}
        errorComponent={
          error && (
            <Alert className="mt-4" severity="error">
              {error.message}
            </Alert>
          )
        }
      />
    </FormProvider>
  );
}
