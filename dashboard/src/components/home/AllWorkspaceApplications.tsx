import { RenderWorkspacesWithApps } from '@/components/applications/RenderWorkspacesWithApps';
import type { UserData } from '@/hooks/useGetAllUserWorkspacesAndApplications';

export function AllWorkspacesApplications({
  userData,
  query,
}: {
  userData: UserData | null;
  query: string;
}) {
  return <RenderWorkspacesWithApps query={query} userData={userData} />;
}

export default AllWorkspacesApplications;
