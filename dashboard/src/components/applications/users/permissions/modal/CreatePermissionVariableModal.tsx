import { useWorkspaceContext } from '@/context/workspace-context';
import useCustomClaims from '@/hooks/useCustomClaims';
import type { CustomClaim } from '@/types/application';
import { Alert } from '@/ui/Alert';
import { triggerToast } from '@/utils/toast';
import {
  refetchGetAppCustomClaimsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type {
  CreatePermissionVariableBaseFormData,
  CreatePermissionVariableModalBaseProps,
} from './CreatePermissionVariableModalBase';
import CreatePermissionVariableModalBase from './CreatePermissionVariableModalBase';

export type CreatePermissionVariableFormData =
  CreatePermissionVariableBaseFormData;

export type CreatePermissionVariableModalProps = Pick<
  CreatePermissionVariableModalBaseProps,
  'onClose'
>;

export default function CreatePermissionVariableModal({
  onClose,
}: CreatePermissionVariableModalProps) {
  const [error, setError] = useState<Error>();

  const form = useForm<CreatePermissionVariableFormData>({
    reValidateMode: 'onSubmit',
  });

  const {
    workspaceContext: { appId },
  } = useWorkspaceContext();

  const { data: customClaims } = useCustomClaims({ appId });

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: [refetchGetAppCustomClaimsQuery({ id: appId })],
  });

  async function handleSubmit(permissionVariable: CustomClaim) {
    setError(undefined);

    try {
      if (
        customClaims.some(
          (claim) =>
            claim.key.toLowerCase() === permissionVariable.key.toLowerCase(),
        )
      ) {
        throw new Error(
          'Permission variable with this field name already exists.',
        );
      }

      await updateApp({
        variables: {
          id: appId,
          app: {
            authJwtCustomClaims: [...customClaims, permissionVariable]
              .filter((claim) => !claim.isSystemClaim)
              .reduce(
                (authJwtCustomClaims, claim) => ({
                  ...authJwtCustomClaims,
                  [claim.key]: claim.value,
                }),
                {},
              ),
          },
        },
      });

      triggerToast('Permission variable created');

      if (!onClose) {
        return;
      }

      onClose();
    } catch (updateError) {
      if (updateError instanceof Error) {
        setError(updateError);
      } else {
        setError(new Error(updateError));
      }
    }
  }

  return (
    <FormProvider {...form}>
      <CreatePermissionVariableModalBase
        title="Create Permission Variable"
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
