import { useGetUserAllWorkspacesQuery } from '@/utils/__generated__/graphql';
import { useEffect, useState } from 'react';

function checkForApplicationsOnAllWorkspaces(workspaces, setNoApplications) {
  let noApplications = true;

  workspaces.forEach(({ workspace }) => {
    if (noApplications && workspace.apps.length !== 0) {
      noApplications = false;
    }
  });

  setNoApplications(noApplications);
}

export function useCheckApplications() {
  const { data, loading, error } = useGetUserAllWorkspacesQuery();
  const [noApplications, setNoApplications] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }

    const { workspaceMembers } = data;
    const noWorkspaces = workspaceMembers?.length === 0;

    if (noWorkspaces) {
      setNoApplications(true);
    }

    checkForApplicationsOnAllWorkspaces(workspaceMembers, setNoApplications);
  }, [data, loading, noApplications, setNoApplications]);

  return { data, loading, error, noApplications };
}

export default useCheckApplications;
