import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ContainerIndexApplications } from '@/components/dashboard/ContainerIndexApplications';
import { NoApplications } from '@/components/dashboard/NoApplications';
import { AllWorkspacesApplications } from '@/components/home/AllWorkspaceApplications';
import { IndexHeaderApps } from '@/components/home/IndexHeaderApps';
import { useUserDataContext } from '@/context/workspace1-context';
import { useCheckApplications } from '@/hooks/useCheckApplications';
import type { UserData } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import { useEffect, useState } from 'react';

export function Applications() {
  const [filtered, setFiltered] = useState<UserData | null>(null);
  const [query, setQuery] = useState('');

  const { userContext } = useUserDataContext();

  useEffect(() => {
    setFiltered(userContext);
  }, [userContext]);

  const { loading, error, noApplications } = useCheckApplications();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    throw error;
  }

  if (noApplications) {
    return (
      <ContainerIndexApplications>
        <NoApplications />
      </ContainerIndexApplications>
    );
  }

  return (
    <ContainerIndexApplications>
      <IndexHeaderApps query={query} setQuery={setQuery} />
      <AllWorkspacesApplications query={query} userData={filtered} />
    </ContainerIndexApplications>
  );
}

export default Applications;
