import { useWorkspaceContext } from '@/context/workspace-context';
import { useUserFirstWorkspace } from '@/utils/use-firstWorkspace';
import { useEffect, useState } from 'react';

type Workspace = {
  name: string;
  slug: string;
  id: string;
};

export function useFetchFirstWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>({
    name: '',
    slug: '',
    id: '',
  });
  const { workspaceContext, setWorkspaceContext } = useWorkspaceContext();
  const { data, loading, error, stopPolling, client } = useUserFirstWorkspace();

  useEffect(() => {
    if (workspaceContext.slug) {
      return;
    }
    if (data?.workspaceMembers[0]) {
      const fetchedWorkspace = data.workspaceMembers[0].workspace;
      const { name } = fetchedWorkspace;
      const { slug } = fetchedWorkspace;
      const { id } = fetchedWorkspace;
      setWorkspace({ name, slug, id });
    }

    if (!workspaceContext.id && data) {
      setWorkspaceContext({
        name: workspace.name,
        slug: workspace.slug,
        id: workspace.id,
        app: '',
        appId: '',
        appSlug: '',
        appName: '',
        appSubdomain: '',
        appAdminSecret: '',
        appIsProvisioned: false,
        repository: '',
        provisioning: false,
      });
      stopPolling();
      client.refetchQueries({ include: ['getOneUser'] });
    }
  }, [data]);
  return { data, loading, error };
}

export default useFetchFirstWorkspace;
