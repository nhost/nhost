import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';

import { useServiceStatus } from '@/features/orgs/projects/common/hooks/useServiceStatus';
import { ServiceAccordion } from '@/features/orgs/projects/overview/components/ServiceAccordion';
import {
  findHighestImportanceState,
  type baseServices,
} from '@/features/orgs/projects/overview/health';
import { removeTypename } from '@/utils/helpers';
import { twMerge } from 'tailwind-merge';

export interface OverviewProjectHealthModalProps {
  defaultExpanded?: keyof typeof baseServices | 'run';
}

export default function OverviewProjectHealthModal({
  defaultExpanded,
}: OverviewProjectHealthModalProps) {
  const { auth, storage, postgres, hasura, ai, run } = useServiceStatus({
    fetchPolicy: 'cache-only',
    shouldPoll: false,
  });

  const runServices = Object.values(run).filter((service) =>
    service.name.startsWith('run-'),
  );

  const isAuthExpandedByDefault = defaultExpanded === 'hasura-auth';
  const isPostgresExpandedByDefault = defaultExpanded === 'postgres';
  const isStorageExpandedByDefault = defaultExpanded === 'hasura-storage';
  const isHasuraExpandedByDefault = defaultExpanded === 'hasura';
  const isAIExpandedByDefault = defaultExpanded === 'ai';
  const isRunExpandedByDefault = defaultExpanded === 'run';

  const getServiceInfo = (service) => {
    const info = removeTypename(service);
    return JSON.stringify(info, null, 2);
  };

  const serviceInfo = {
    auth: getServiceInfo(auth),
    storage: getServiceInfo(storage),
    postgres: getServiceInfo(postgres),
    hasura: getServiceInfo(hasura),
    ai: getServiceInfo(ai),
    run: getServiceInfo(Object.values(runServices)),
  };

  const runServicesState = findHighestImportanceState(
    Object.values(runServices).map((service) => service.state),
  );

  return (
    <Box className={twMerge('w-full rounded-lg pt-2 text-left')}>
      <Box
        sx={{
          borderColor: 'text.dark',
        }}
        className="grid grid-flow-row"
      >
        <Divider />
        <ServiceAccordion
          icon={<UserIcon className="h-4 w-4" />}
          serviceName="Auth"
          serviceInfo={serviceInfo.auth}
          replicaCount={auth?.replicas?.length}
          serviceState={auth?.state}
          defaultExpanded={isAuthExpandedByDefault}
        />
        <Divider />
        <ServiceAccordion
          icon={<DatabaseIcon className="h-4 w-4" />}
          serviceName="Postgres"
          serviceInfo={serviceInfo.postgres}
          replicaCount={postgres?.replicas?.length}
          serviceState={postgres?.state}
          defaultExpanded={isPostgresExpandedByDefault}
        />
        <Divider />
        <ServiceAccordion
          icon={<StorageIcon className="h-4 w-4" />}
          serviceName="Storage"
          serviceInfo={serviceInfo.storage}
          replicaCount={storage?.replicas?.length}
          serviceState={storage?.state}
          defaultExpanded={isStorageExpandedByDefault}
        />
        <Divider />
        <ServiceAccordion
          icon={<HasuraIcon className="h-4 w-4" />}
          serviceName="Hasura"
          serviceInfo={serviceInfo.hasura}
          replicaCount={hasura?.replicas?.length}
          serviceState={hasura?.state}
          defaultExpanded={isHasuraExpandedByDefault}
        />
        {ai ? (
          <>
            <Divider />
            <ServiceAccordion
              icon={<AIIcon className="h-4 w-4" />}
              serviceName="AI"
              serviceInfo={serviceInfo.ai}
              replicaCount={ai?.replicas?.length}
              serviceState={ai?.state}
              defaultExpanded={isAIExpandedByDefault}
            />
          </>
        ) : null}
        {runServices && Object.values(runServices).length > 0 ? (
          <>
            <Divider />
            <ServiceAccordion
              icon={<ServicesOutlinedIcon className="h-4 w-4" />}
              serviceName="Run"
              serviceInfo={serviceInfo.run}
              replicaCount={0}
              serviceState={runServicesState}
              defaultExpanded={isRunExpandedByDefault}
            />
          </>
        ) : null}
      </Box>
    </Box>
  );
}
