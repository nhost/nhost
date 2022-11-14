import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Container from '@/components/layout/Container';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { getErrorMessage, inputErrorMessages } from '@/utils/getErrorMessage';
import { slugifyString } from '@/utils/helpers';
import { nhost } from '@/utils/nhost';
import { useInsertWorkspaceMutation } from '@/utils/__generated__/graphql';
import router from 'next/router';
import type { ReactElement } from 'react';
import React, { useState } from 'react';
import slugify from 'slugify';

// TODO: Refactor form to use `react-hook-form` instead
export default function CreateWorkspacePage() {
  const [workspace, setWorkspace] = useState('');
  const [workspaceError, setWorkspaceError] = useState<string>('');
  const [insertWorkspace, { loading }] = useInsertWorkspaceMutation({
    refetchQueries: ['getUserWorkspaces'],
  });
  const slug = slugify(workspace, { lower: true, strict: true });
  const user = nhost.auth.getUser();

  const userId = user!.id;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorkspaceError('');

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
      return;
    }

    try {
      await insertWorkspace({
        variables: {
          workspace: {
            name: workspace,
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
      router.push(`/${slug}`);
    } catch (error: any) {
      setWorkspaceError(getErrorMessage(error, 'workspace'));
    }
  }

  return (
    <Container>
      <div className="mx-auto max-w-8xl">
        <div className="space-y-1 font-display">
          <div className="mt-4 flex flex-row">
            <Text
              variant="body"
              size="big"
              color="greyscaleDark"
              className="font-medium"
            >
              New Workspace
            </Text>
          </div>
          <div className="mt-5 flex flex-col pt-7 font-display">
            <div className="mt-4 flex flex-row">
              <div className="w-form py-2">
                <Text
                  variant="body"
                  color="dark"
                  size="normal"
                  className="self-center font-medium"
                >
                  Workspace
                </Text>
              </div>
              <div className="mt-2 flex flex-col">
                <Input
                  type="text"
                  placeholder="Your new Workspace"
                  name="workspace"
                  id="workspace"
                  className="focus:outline-none focus:ring-0"
                  onChange={(value) => {
                    setWorkspace(value);
                    setWorkspaceError('');
                  }}
                />
                <Text
                  variant="body"
                  color="greyscaleDark"
                  size="tiny"
                  className="pt-1 pb-1 pl-0.5 text-left font-normal"
                >
                  https://app.nhost.io/{slugifyString(workspace)}
                </Text>

                {workspaceError && (
                  <Alert severity="error">{workspaceError}</Alert>
                )}
              </div>
            </div>

            <div className="mt-18 flex min-w-2.5xl place-content-between">
              <Button
                type="reset"
                border
                transparent
                onClick={() => {
                  router.push('/');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!!workspaceError || loading}
                onClick={handleSubmit}
              >
                Create Workspace
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

CreateWorkspacePage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="New Workspace">{page}</AuthenticatedLayout>
  );
};
