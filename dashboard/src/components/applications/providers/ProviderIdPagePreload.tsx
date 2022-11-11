import { useGetAppLoginDataQuery } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { ProviderPage } from './ProviderPage';

export function ProviderPagePreload() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetAppLoginDataQuery({
    variables: {
      id: currentApplication?.id,
    },
    skip: !currentApplication?.id,
  });

  if (error) {
    throw error;
  }

  if (loading) {
    return <ActivityIndicator delay={500} label="Loading providers..." />;
  }

  return <ProviderPage app={data?.app} />;
}

export default ProviderPagePreload;
