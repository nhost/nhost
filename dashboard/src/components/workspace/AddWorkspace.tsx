import { useUI } from '@/context/UIContext';
import { useInsertWorkspaceMutation } from '@/generated/graphql';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { getErrorMessage, inputErrorMessages } from '@/utils/getErrorMessage';
import { slugifyString } from '@/utils/helpers';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import router from 'next/router';
import React, { useState } from 'react';
import slugify from 'slugify';

function AddNewWorkspaceForm({ closeSection: externalCloseSection }) {
  const [workspace, setWorkspace] = useState('');
  const { closeSection } = useUI();
  const [workspaceError, setWorkspaceError] = useState<string>('');
  const [loadingAddWorkspace, setLoadingAddWorkspace] = useState(false);

  const [insertWorkspace, { client }] = useInsertWorkspaceMutation();

  const slug = slugify(workspace, { lower: true, strict: true });
  const user = nhost.auth.getUser();
  if (!user) {
    return <div>No user..</div>;
  }
  const userId = user.id;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorkspaceError('');
    setLoadingAddWorkspace(true);

    if (
      !inputErrorMessages(
        workspace,
        setWorkspace,
        setWorkspaceError,
        'Workspace',
      )
    ) {
      return;
    }

    if (slug.length < 4 || slug.length > 32) {
      setWorkspaceError('Slug should be within 4 and 32 characters.');
      setLoadingAddWorkspace(false);
      return;
    }

    const currentUser = nhost.auth.getUser();

    if (!currentUser) {
      triggerToast('User is not signed in');
      setLoadingAddWorkspace(false);
      return;
    }

    try {
      await insertWorkspace({
        variables: {
          workspace: {
            name: workspace,
            companyName: workspace,
            email: user.email,
            slug,
            workspaceMembers: {
              data: [
                {
                  userId,
                  type: 'owner',
                },
              ],
            },
          },
        },
      });
      await client.refetchQueries({ include: ['getOneUser'] });
      router.push(`/${slug}`);
      setLoadingAddWorkspace(false);
      closeSection();
    } catch (error: any) {
      setWorkspaceError(getErrorMessage(error, 'workspace'));
      setLoadingAddWorkspace(false);
    }
  }
  return (
    <form onSubmit={handleSubmit} className="grid grid-flow-row gap-4">
      <Input
        type="text"
        placeholder="Your new workspace"
        name="workspace"
        id="workspace"
        label="Workspace"
        fullWidth
        autoFocus
        helperText={`https://app.nhost.io/${slugifyString(workspace)}`}
        onChange={(event) => {
          setWorkspace(event.target.value);
          setWorkspaceError('');
        }}
      />

      {workspaceError && <Alert severity="error">{workspaceError}</Alert>}

      <div className="grid grid-flow-col justify-between gap-2">
        <Button
          variant="outlined"
          color="secondary"
          onClick={(e) => {
            e.preventDefault();
            externalCloseSection();
          }}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={!!workspaceError}
          loading={loadingAddWorkspace}
        >
          Create Workspace
        </Button>
      </div>
    </form>
  );
}

export default function AddWorkspace() {
  const { closeSection } = useUI();

  const user = nhost.auth.getUser();

  if (!user) {
    return <div>No user..</div>;
  }

  return (
    <div className="grid w-modal grid-flow-row gap-2 px-6 py-6 text-left">
      <div className="grid w-full grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          New Workspace
        </Text>

        <Text variant="subtitle2">
          Invite team members to workspaces to work collaboratively.
        </Text>
      </div>

      <AddNewWorkspaceForm closeSection={closeSection} />
    </div>
  );
}
