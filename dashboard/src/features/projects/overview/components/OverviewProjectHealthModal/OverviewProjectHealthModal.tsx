import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { useServiceStatus } from '@/features/projects/common/hooks/useServiceStatus';
import { RunServicesAccordion } from '@/features/projects/overview/components/RunServicesAccordion';
import { ServiceAccordion } from '@/features/projects/overview/components/ServiceAccordion';
import { type baseServices } from '@/features/projects/overview/health';
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
          serviceHealth={auth}
          replicas={auth?.replicas}
          serviceState={auth?.state}
          defaultExpanded={isAuthExpandedByDefault}
        />
        <Divider />
        <ServiceAccordion
          icon={<DatabaseIcon className="h-4 w-4" />}
          serviceName="Postgres"
          serviceHealth={postgres}
          replicas={postgres?.replicas}
          serviceState={postgres?.state}
          defaultExpanded={isPostgresExpandedByDefault}
        />
        <Divider />
        <ServiceAccordion
          icon={<StorageIcon className="h-4 w-4" />}
          serviceName="Storage"
          serviceHealth={storage}
          replicas={storage?.replicas}
          serviceState={storage?.state}
          defaultExpanded={isStorageExpandedByDefault}
        />
        <Divider />
        <ServiceAccordion
          icon={<HasuraIcon className="h-4 w-4" />}
          serviceName="Hasura"
          serviceHealth={hasura}
          replicas={hasura?.replicas}
          serviceState={hasura?.state}
          defaultExpanded={isHasuraExpandedByDefault}
        />
        {ai ? (
          <>
            <Divider />
            <ServiceAccordion
              icon={<AIIcon className="h-4 w-4" />}
              serviceName="AI"
              serviceHealth={ai}
              replicas={ai.replicas}
              serviceState={ai.state}
              defaultExpanded={isAIExpandedByDefault}
            />
          </>
        ) : null}
        {runServices && Object.values(runServices).length > 0 ? (
          <>
            <Divider />
            <RunServicesAccordion
              servicesHealth={Object.values(runServices)}
              icon={<ServicesOutlinedIcon className="h-4 w-4" />}
              serviceStates={Object.values(runServices).map(
                (service) => service.state,
              )}
              defaultExpanded={isRunExpandedByDefault}
            />
          </>
        ) : null}
      </Box>
    </Box>
  );
}
