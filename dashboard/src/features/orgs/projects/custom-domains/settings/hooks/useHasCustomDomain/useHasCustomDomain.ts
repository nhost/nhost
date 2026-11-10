import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetAuthenticationSettingsQuery,
  useGetHasuraSettingsQuery,
  useGetServerlessFunctionsSettingsQuery,
} from '@/generated/graphql';

interface Ingress {
  fqdn?: ReadonlyArray<string> | null;
}

const hasFqdn = (ingresses?: ReadonlyArray<Ingress | null> | null) =>
  (ingresses ?? []).some((ingress) => (ingress?.fqdn?.length ?? 0) > 0);

/**
 * Whether any service of the project already routes a custom domain. The
 * database domain is DNS-only and never stored, so it cannot be counted.
 */
export default function useHasCustomDomain() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const options = {
    variables: { appId: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  };

  const auth = useGetAuthenticationSettingsQuery(options);
  const hasura = useGetHasuraSettingsQuery(options);
  const functions = useGetServerlessFunctionsSettingsQuery(options);
  const { services, loading: loadingServices } = useRunServices();

  const hasCustomDomain =
    hasFqdn(auth.data?.config?.auth?.resources?.networking?.ingresses) ||
    hasFqdn(hasura.data?.config?.hasura?.resources?.networking?.ingresses) ||
    hasFqdn(
      functions.data?.config?.functions?.resources?.networking?.ingresses,
    ) ||
    services.some((service) =>
      (service.config?.ports ?? []).some((port) => hasFqdn(port?.ingresses)),
    );

  return {
    hasCustomDomain,
    loading:
      loadingProject ||
      auth.loading ||
      hasura.loading ||
      functions.loading ||
      loadingServices,
  };
}
