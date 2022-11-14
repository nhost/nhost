import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { inputErrorMessages } from '@/utils/getErrorMessage';
import { slugifyString } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { useUpdateWorkspaceMutation } from '@/utils/__generated__/graphql';
import router from 'next/router';
import type { ChangeEvent } from 'react';
import React, { useState } from 'react';

type ChangeWorkspaceNameProps = {
  close: VoidFunction;
};

export default function ChangeWorkspaceName({
  close,
}: ChangeWorkspaceNameProps) {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const [newWorkspaceName, setNewWorkspaceName] = useState(
    currentWorkspace.name,
  );
  const [workspaceError, setWorkspaceError] = useState<string>('');

  const [updateWorkspace, { loading: mutationLoading, error: mutationError }] =
    useUpdateWorkspaceMutation({
      refetchQueries: [],
    });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    inputErrorMessages(
      event.target.value,
      setNewWorkspaceName,
      setWorkspaceError,
      'Workspace',
    );
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = newWorkspaceName;
    const slug = slugifyString(name);

    if (slug.length < 4 || slug.length > 32) {
      setWorkspaceError('Slug should be within 4 and 32 characters.');
      return;
    }

    try {
      await updateWorkspace({
        variables: {
          id: currentWorkspace.id,
          workspace: {
            name,
            slug,
          },
        },
      });
      close();
      triggerToast('Workspace name changed');
    } catch (error) {
      await discordAnnounce(
        `Error trying to remove workspace: ${currentWorkspace.id} - ${error.message}`,
      );
    }
    await router.push(slug);
  }

  return (
    <div className="w-modal px-6 py-6 text-left">
      <div className="flex flex-col">
        <Text variant="h3" component="h2">
          Change Workspace Name
        </Text>

        <form onSubmit={handleSubmit}>
          <div className="mt-4 grid grid-flow-row gap-2">
            <Input
              id="workspaceName"
              label="New Workspace Name"
              onChange={handleChange}
              value={newWorkspaceName}
              placeholder="New workspace name"
              fullWidth
              autoFocus
              autoComplete="off"
              helperText={`https://app.nhost.io/${slugifyString(
                newWorkspaceName || '',
              )}`}
            />

            {workspaceError && <Alert severity="error">{workspaceError}</Alert>}

            {mutationError && (
              <Alert severity="error">{mutationError.toString()}</Alert>
            )}
          </div>

          <div className="mt-6 grid grid-flow-row gap-2">
            <Button
              type="submit"
              disabled={mutationLoading || !!workspaceError}
            >
              Save Changes
            </Button>

            <Button variant="outlined" color="secondary" onClick={close}>
              Close
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
