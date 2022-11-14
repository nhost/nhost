import { useWorkspaceContext } from '@/context/workspace-context';
import { useEffect } from 'react';

export function useCleanWorkspaceContext() {
  const { setWorkspaceContext } = useWorkspaceContext();

  useEffect(() => {
    setWorkspaceContext({
      id: '',
      name: '',
      slug: '',
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
  }, [setWorkspaceContext]);
}

export default useCleanWorkspaceContext;
