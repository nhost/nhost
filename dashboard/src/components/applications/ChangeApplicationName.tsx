import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { inputErrorMessages } from '@/utils/getErrorMessage';
import { slugifyString } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useUpdateApplicationMutation } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import React, { useState } from 'react';

export function ChangeApplicationName({ close }) {
  const [updateAppName, { client }] = useUpdateApplicationMutation({});
  const { workspaceContext } = useWorkspaceContext();
  const [name, setName] = useState(workspaceContext.appName);
  const [applicationError, setApplicationError] = useState<any>('');
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const slug = slugifyString(name);
    if (slug.length < 4 || slug.length > 32) {
      setApplicationError('Slug should be within 4 and 32 characters.');
      return;
    }
    if (!inputErrorMessages(name, setName, setApplicationError, 'project')) {
      return;
    }

    try {
      await updateAppName({
        variables: {
          appId: currentApplication.id,
          app: {
            name,
            slug,
          },
        },
      });

      triggerToast('Project name changed');
    } catch (error) {
      await discordAnnounce(
        `Error trying to delete project: ${currentApplication.name}`,
      );
    }

    await updateOwnCache(client);
    await router.push(`/${currentWorkspace.slug}/${slug}`);
  }

  return (
    <div className="w-modal px-6 py-6 text-left">
      <div className="flex flex-col">
        <Text variant="h3" component="h2">
          Change Project Name
        </Text>

        <form onSubmit={handleSubmit}>
          <div className="mt-4 grid grid-flow-row gap-2">
            <Input
              label="New Project Name"
              id="projectName"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setApplicationError('');
              }}
              fullWidth
              autoFocus
              helperText={`https://app.nhost.io/${
                currentWorkspace.slug
              }/${slugifyString(name)}`}
            />

            {applicationError && (
              <Alert severity="error">{applicationError}</Alert>
            )}
          </div>

          <div className="mt-4 grid grid-flow-row gap-2">
            <Button type="submit" disabled={applicationError}>
              Save
            </Button>

            <Button
              type="button"
              variant="outlined"
              color="secondary"
              onClick={close}
            >
              Close
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangeApplicationName;
