import { SiHasura as HasuraIcon } from '@icons-pack/react-simple-icons';
import {
  Sparkles as AIIcon,
  DatabaseIcon,
  HardDrive as StorageIcon,
  UserIcon,
} from 'lucide-react';
import { ServicesOutlinedIcon } from '@/components/ui/v3/icons/ServicesOutlinedIcon';
import { Separator } from '@/components/ui/v3/separator';
import { useServiceStatus } from '@/features/orgs/projects/common/hooks/useServiceStatus';
import { ServiceAccordion } from '@/features/orgs/projects/overview/components/ServiceAccordion';
import {
  type baseServices,
  findHighestImportanceState,
  type ServiceHealthInfo,
} from '@/features/orgs/projects/overview/health';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { removeTypename } from '@/utils/helpers';

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

  const runServices: ServiceHealthInfo[] = Object.values(run).filter(
    (service): service is ServiceHealthInfo =>
      isNotEmptyValue(service) && service.name.startsWith('run-'),
  );

  const hasNoServices =
    isEmptyValue(auth) &&
    isEmptyValue(storage) &&
    isEmptyValue(postgres) &&
    isEmptyValue(hasura) &&
    isEmptyValue(ai) &&
    isEmptyValue(runServices);

  if (hasNoServices) {
    return (
      <div className="w-full rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Service health information is unavailable. This is usually temporary
          while the project is paused or transitioning.
        </p>
      </div>
    );
  }

  const isAuthExpandedByDefault = defaultExpanded === 'hasura-auth';
  const isPostgresExpandedByDefault = defaultExpanded === 'postgres';
  const isStorageExpandedByDefault = defaultExpanded === 'hasura-storage';
  const isHasuraExpandedByDefault = defaultExpanded === 'hasura';
  const isAIExpandedByDefault = defaultExpanded === 'ai';
  const isRunExpandedByDefault = defaultExpanded === 'run';

  const convertServiceIntoJSON = (service: unknown) => {
    const info = removeTypename(service);
    return JSON.stringify(info, null, 2) ?? '';
  };

  const serviceInfo = {
    auth: convertServiceIntoJSON(auth),
    storage: convertServiceIntoJSON(storage),
    postgres: convertServiceIntoJSON(postgres),
    hasura: convertServiceIntoJSON(hasura),
    ai: convertServiceIntoJSON(ai),
    run: convertServiceIntoJSON(Object.values(runServices)),
  };

  const runServicesState = findHighestImportanceState(
    Object.values(runServices).map((service) => service.state),
  );

  return (
    <div className="w-full rounded-lg pt-2 text-left">
      <div className="grid grid-flow-row">
        <Separator />
        {isNotEmptyValue(auth) && isNotEmptyValue(serviceInfo.auth) && (
          <ServiceAccordion
            icon={<UserIcon className="h-4 w-4" />}
            serviceName="Auth"
            serviceInfo={serviceInfo.auth}
            replicaCount={auth?.replicas?.length}
            serviceState={auth?.state}
            defaultExpanded={isAuthExpandedByDefault}
          />
        )}
        <Separator />
        {isNotEmptyValue(postgres) && isNotEmptyValue(serviceInfo.postgres) && (
          <ServiceAccordion
            icon={<DatabaseIcon className="h-4 w-4" />}
            serviceName="Postgres"
            serviceInfo={serviceInfo.postgres}
            replicaCount={postgres?.replicas?.length}
            serviceState={postgres?.state}
            defaultExpanded={isPostgresExpandedByDefault}
          />
        )}
        <Separator />
        {isNotEmptyValue(storage) && isNotEmptyValue(serviceInfo.storage) && (
          <ServiceAccordion
            icon={<StorageIcon className="h-4 w-4" />}
            serviceName="Storage"
            serviceInfo={serviceInfo.storage}
            replicaCount={storage?.replicas?.length}
            serviceState={storage?.state}
            defaultExpanded={isStorageExpandedByDefault}
          />
        )}
        <Separator />
        {isNotEmptyValue(hasura) && isNotEmptyValue(serviceInfo.hasura) && (
          <ServiceAccordion
            icon={<HasuraIcon className="h-4 w-4" />}
            serviceName="Hasura"
            serviceInfo={serviceInfo.hasura}
            replicaCount={hasura?.replicas?.length}
            serviceState={hasura?.state}
            defaultExpanded={isHasuraExpandedByDefault}
          />
        )}
        {ai ? (
          <>
            <Separator />
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
        {isNotEmptyValue(runServices) && isNotEmptyValue(serviceInfo.run) ? (
          <>
            <Separator />
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
      </div>
    </div>
  );
}
