import { useWorkspaceContext } from '@/context/workspace-context';
import useCustomClaims from '@/hooks/useCustomClaims';
import type { CustomClaim } from '@/types/application';
import { Alert } from '@/ui/Alert';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
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

export type EditPermissionVariableFormData =
  CreatePermissionVariableBaseFormData;

export type EditPermissionVariableModalProps = Pick<
  CreatePermissionVariableModalBaseProps,
  'onClose'
> & {
  /**
   * The permission variable to edit.
   */
  payload: CustomClaim;
};

export default function EditPermissionVariableModal({
  payload: originalCustomClaim,
  ...props
}: EditPermissionVariableModalProps) {
  const [error, setError] = useState<Error>();
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const form = useForm<EditPermissionVariableFormData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      key: originalCustomClaim.key || '',
      value: originalCustomClaim.value || '',
    },
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
        originalCustomClaim.key.toLowerCase() !==
          permissionVariable.key.toLowerCase() &&
        customClaims.some(
          (claim) =>
            claim.key.toLowerCase() === permissionVariable.key.toLowerCase(),
        )
      ) {
        throw new Error(
          'Permission variable with this field name already exists.',
        );
      }

      // we need to preserve the original position of the permission variable
      const currentIndex = customClaims.findIndex(
        (claim) =>
          claim.key.toLowerCase() === originalCustomClaim.key.toLowerCase(),
      );

      await updateApp({
        variables: {
          id: appId,
          app: {
            authJwtCustomClaims: customClaims
              .slice(0, currentIndex)
              .concat(permissionVariable)
              .concat(customClaims.slice(currentIndex + 1))
              .filter((claim) => !claim.system)
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

      triggerToast(`Permission variable updated`);

      if (props.onClose) {
        props.onClose();
      }
    } catch (updateError) {
      if (updateError instanceof Error) {
        setError(updateError);
      } else {
        setError(new Error(updateError));
      }
    }
  }

  async function handleRemove() {
    setError(undefined);

    try {
      await updateApp({
        variables: {
          id: appId,
          app: {
            authJwtCustomClaims: customClaims
              .filter(
                (claim) =>
                  claim.key !== originalCustomClaim.key && !claim.system,
              )
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

      setShowRemoveModal(false);

      triggerToast('Permission variable removed');

      if (props.onClose) {
        props.onClose();
      }
    } catch (updateError) {
      if (updateError instanceof Error) {
        setError(updateError);
      } else {
        setError(new Error(updateError));
      }
    }
  }

  return (
    <>
      <Modal
        showModal={showRemoveModal}
        close={() => setShowRemoveModal(false)}
      >
        <div className="grid w-96 grid-flow-row gap-2 p-6 text-left text-greyscaleDark">
          <Text variant="h3" component="h2">
            Remove {originalCustomClaim.key}?
          </Text>

          <Text>You will not be able to use it in permissions anymore.</Text>

          <Text>
            If you have permission checks currently using this property, they
            will never resolve to true.
          </Text>

          <div className="mt-2 grid grid-flow-row gap-2">
            <Button color="error" onClick={handleRemove} className="w-full">
              Remove Permission Variable
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setShowRemoveModal(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <FormProvider {...form}>
        <CreatePermissionVariableModalBase
          title="Edit Permission Variable"
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
