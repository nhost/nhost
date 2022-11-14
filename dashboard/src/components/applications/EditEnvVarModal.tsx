import { useWorkspaceContext } from '@/context/workspace-context';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { triggerToast } from '@/utils/toast';
import type { EnvironmentVariableFragment } from '@/utils/__generated__/graphql';
import {
  refetchGetEnvironmentVariablesWhereQuery,
  useDeleteEnvironmentVariableMutation,
  useUpdateEnvironmentVariableMutation,
} from '@/utils/__generated__/graphql';
import React, { useState } from 'react';

type EnvModalProps = {
  show: boolean;
  close: VoidFunction;
  envVar: EnvironmentVariableFragment;
};

export default function EditEnvVarModal({
  show,
  close,
  envVar,
}: EnvModalProps) {
  const { workspaceContext } = useWorkspaceContext();
  const { appId } = workspaceContext;

  const [updateEnvVar, { loading: updateLoading }] =
    useUpdateEnvironmentVariableMutation({
      refetchQueries: [
        refetchGetEnvironmentVariablesWhereQuery({
          where: {
            appId: {
              _eq: appId,
            },
          },
        }),
      ],
    });

  const [deleteEnvVar, { loading: deleteLoading }] =
    useDeleteEnvironmentVariableMutation({
      refetchQueries: [
        refetchGetEnvironmentVariablesWhereQuery({
          where: {
            appId: {
              _eq: appId,
            },
          },
        }),
      ],
    });

  const [prodValue, setProdValue] = useState(envVar.prodValue || '');
  const [devValue, setDevValue] = useState(envVar.devValue || '');

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await updateEnvVar({
        variables: {
          id: envVar.id,
          environmentVariable: {
            prodValue,
            devValue,
          },
        },
      });
    } catch (error) {
      close();
      triggerToast('Error updating environment variable');
      return;
    }
    triggerToast(`Environment variable ${envVar.name} updated successfully`);
    close();
  };

  const handleDelete = async () => {
    try {
      await deleteEnvVar({
        variables: {
          id: envVar.id,
        },
      });
    } catch (error) {
      close();
      triggerToast('Error deleting environment variable');
      return;
    }
    triggerToast(`Environment variable ${envVar.name} removed successfully`);
    close();
  };

  return (
    <Modal showModal={show} close={close}>
      <form onSubmit={handleSubmit}>
        <div className="w-modal px-6 py-6 text-left">
          <div className="grid grid-flow-row gap-1">
            <Text variant="h3" component="h2">
              {envVar.name}
            </Text>

            <Text variant="subtitle2">
              The default value will be available in all environments, unless
              you override it. All values are encrypted.
            </Text>

            <div className="my-2 grid grid-flow-row gap-2">
              <Input
                id="name"
                label="Name"
                autoFocus
                disabled
                autoComplete="off"
                defaultValue={envVar.name}
                fullWidth
                hideEmptyHelperText
              />

              <Input
                id="prodValue"
                label="Production Value"
                fullWidth
                placeholder="Enter a value"
                value={prodValue}
                onChange={(event) => setProdValue(event.target.value)}
                hideEmptyHelperText
              />

              <Input
                id="devValue"
                label="Development Value"
                fullWidth
                placeholder="Enter a value"
                value={devValue}
                onChange={(event) => setDevValue(event.target.value)}
                hideEmptyHelperText
              />
            </div>

            <div className="grid grid-flow-row gap-2">
              <Button type="submit" loading={updateLoading}>
                Save
              </Button>

              <Button
                variant="outlined"
                color="error"
                loading={deleteLoading}
                onClick={handleDelete}
              >
                Delete
              </Button>

              <Button onClick={close} variant="outlined" color="secondary">
                Close
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
