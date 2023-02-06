import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Container from '@/components/layout/Container';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { getErrorMessage, inputErrorMessages } from '@/utils/getErrorMessage';
import { slugifyString } from '@/utils/helpers';
import { useInsertWorkspaceMutation } from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import router from 'next/router';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import slugify from 'slugify';

// TODO: Refactor form to use `react-hook-form` instead
export default function CreateWorkspacePage() {
  const [workspace, setWorkspace] = useState('');
  const [workspaceError, setWorkspaceError] = useState<string>('');
  const [insertWorkspace, { loading }] = useInsertWorkspaceMutation({
    refetchQueries: ['getUserWorkspaces'],
  });
  const slug = slugify(workspace, { lower: true, strict: true });
  const user = useUserData();

  const userId = user!.id;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
        <form onSubmit={handleSubmit} className="space-y-1 font-display">
          <div className="mt-4 flex flex-row">
            <Text className="font-medium text-2xl">New Workspace</Text>
          </div>

          <div className="mt-5 flex flex-col pt-7 font-display">
            <Input
              label="Name"
              name="name"
              id="name"
              fullWidth
              onChange={(event) => {
                setWorkspace(event.target.value);
                setWorkspaceError('');
              }}
              className="lg:w-1/2"
              error={!!workspaceError}
              helperText={
                workspaceError ||
                `https://app.nhost.io/${slugifyString(workspace)}`
              }
            />

            <div className="mt-18 flex min-w-2.5xl place-content-between">
              <Button
                type="reset"
                color="secondary"
                variant="outlined"
                onClick={() => {
                  router.push('/');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!!workspaceError || loading}>
                Create Workspace
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Container>
  );
}

CreateWorkspacePage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="New Workspace">{page}</AuthenticatedLayout>
  );
};
