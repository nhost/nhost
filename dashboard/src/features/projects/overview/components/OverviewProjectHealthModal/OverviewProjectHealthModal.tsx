import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import type { GetProjectServicesHealthQuery, ServiceState } from '@/utils/__generated__/graphql';
import { type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { serviceStateToColor, getServiceHealthState, findHighestImportanceState, stringifyHealthJSON } from '@/features/projects/overview/health';
import Image from 'next/image';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';

export interface OverviewProjectHealthModalProps {
  servicesHealth?: GetProjectServicesHealthQuery;
}

interface ServiceAccordionProps {
  serviceName: string;
  serviceHealth: GetProjectServicesHealthQuery["getProjectStatus"]["services"][number];
  replicas: GetProjectServicesHealthQuery["getProjectStatus"]["services"][number]["replicas"];
  serviceState: ServiceState;
  /**
   * Icon to display on the accordion.
   */
  icon?: string | ReactElement;
  /**
   * Label of the icon.
   */
  alt?: string;
  iconIsComponent?: boolean;
}

function ServiceAccordion({
  serviceName,
  serviceHealth,
  replicas,
  serviceState,
  icon,
  iconIsComponent = true,
  alt,
}: ServiceAccordionProps) {

  const replicasLabel = replicas.length === 1 ? 'replica' : 'replicas';

  const status = getServiceHealthState(serviceState);

  return (
    <Accordion.Root>
      <Accordion.Summary
        expandIcon={<ChevronDownIcon sx={{
          color: "text.primary"
        }} />}
        aria-controls="panel1-content"
        id="panel1-header"
        className="px-6"
      >
        <div className="flex justify-between flex-row gap-2 py-2">
          <div className="flex items-center gap-3">
            {iconIsComponent
              ? icon
              : typeof icon === 'string' && (
                <Image
                  src={icon}
                  alt={alt}
                />
              )}
            <Text sx={{ color: "text.primary" }} variant="h4" className="font-semibold">
              {serviceName} <Text sx={{
                color: "text.secondary"
              }} component="span" className="font-semibold">({replicas.length} {replicasLabel})</Text></Text>
            {status === "success" ? <Box sx={{
              backgroundColor: serviceStateToColor.get(serviceState),
            }} className="rounded-full w-2 h-2 flex justify-center items-center">
              <CheckIcon className="w-3/4 h-3/4 stroke-2 text-white" />
            </Box>
              : <Box sx={{
                backgroundColor: serviceStateToColor.get(serviceState),
              }} className="rounded-full w-2 h-2" />}
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock
        >
          {stringifyHealthJSON(serviceHealth)}
        </CodeBlock>
      </Accordion.Details>

    </Accordion.Root>
  )
}

interface RunServicesAccordionProps {
  servicesHealth: Array<GetProjectServicesHealthQuery["getProjectStatus"]["services"][number]>;
  serviceStates: ServiceState[];
  /**
   * Icon to display on the accordion.
   */
  icon?: string | ReactElement;
  /**
   * Label of the icon.
   */
  alt?: string;
  iconIsComponent?: boolean;
}

function RunServicesAccordion({
  serviceStates,
  servicesHealth,
  icon,
  iconIsComponent = true,
  alt,
}: RunServicesAccordionProps) {

  const globalState = findHighestImportanceState(serviceStates)

  return (
    <Accordion.Root>
      <Accordion.Summary
        expandIcon={<ChevronDownIcon sx={{
          color: "text.primary"
        }} />}
        aria-controls="panel1-content"
        id="panel1-header"
        className="px-6"
      >
        <div className="flex justify-between flex-row gap-2 py-2">
          <div className="flex items-center gap-3">
            {iconIsComponent
              ? icon
              : typeof icon === 'string' && (
                <Image
                  src={icon}
                  alt={alt}
                />
              )}
            <Text sx={{ color: "text.primary" }} variant="h4" className="font-semibold">
              Run 
            </Text>
            <Box sx={{
              backgroundColor: serviceStateToColor.get(globalState),
            }} className="rounded-full w-2 h-2" />
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock>
          {stringifyHealthJSON(servicesHealth)}
        </CodeBlock>
      </Accordion.Details>

    </Accordion.Root>
  )
}

export default function OverviewProjectHealthModal({
  servicesHealth,
}: OverviewProjectHealthModalProps) {
  type Service = GetProjectServicesHealthQuery["getProjectStatus"]["services"][number];
  const serviceMap: { [key: string]: Service | undefined } = {}
  servicesHealth.getProjectStatus.services.forEach(service => {
    serviceMap[service.name] = service;
  });
  const {
    "hasura-auth": auth,
    "hasura-storage": storage,
    postgres,
    hasura,
    ai,
    ...otherServices
  } = serviceMap;

  const runServices = Object.values(otherServices).filter(service => service.name.startsWith("run-"))

  return (<Box className={twMerge('w-full rounded-lg text-left')}>
    <Box sx={{
      borderColor: "text.dark"
    }} className="grid grid-flow-row gap-1 pt-4">
      <ServiceAccordion
        icon={<UserIcon className="w-4 h-4" />}
        serviceName="Auth"
        serviceHealth={auth}
        replicas={auth?.replicas}
        serviceState={auth?.state}
      />
      <ServiceAccordion
        icon={<DatabaseIcon className="w-4 h-4" />}
        serviceName="Postgres"
        serviceHealth={postgres}
        replicas={postgres?.replicas}
        serviceState={postgres?.state}
      />
      <ServiceAccordion
        icon={<StorageIcon className="w-4 h-4" />}
        serviceName="Storage"
        serviceHealth={storage}
        replicas={storage?.replicas}
        serviceState={storage?.state}
      />
      <ServiceAccordion
        icon={<HasuraIcon className="w-4 h-4" />}
        serviceName="Hasura"
        serviceHealth={hasura}
        replicas={hasura?.replicas}
        serviceState={hasura?.state}
      />
      {ai ? (
        <ServiceAccordion
          icon={<AIIcon className="w-4 h-4" />}
          serviceName="AI"
          serviceHealth={ai}
          replicas={ai.replicas}
          serviceState={ai.state}
        />
      ) : null}
      {Object.values(runServices).length > 0 ? (
        <RunServicesAccordion
          servicesHealth={Object.values(runServices)}
          icon={<ServicesOutlinedIcon className="w-4 h-4" />}
          serviceStates={Object.values(runServices).map((service) => service.state)}
        />
      )
        : null}
    </Box>
  </Box>
  );
}
