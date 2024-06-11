import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import type { GetProjectServicesHealthQuery, ServiceState } from '@/utils/__generated__/graphql';
import { type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { serviceStateToColor, getServiceHealthState, findHighestImportanceState } from '@/features/projects/overview/health';
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
  replicas,
  serviceState,
  icon,
  iconIsComponent = true,
  alt,
}: ServiceAccordionProps) {

  const replicasLabel = replicas.length === 1 ? 'replica' : 'replicas';

  const status = getServiceHealthState(serviceState);

  const getCode = () => {
    const errors = replicas.map((replica) =>
      replica.errors
    );

    if (errors.every((error) => error.length === 0)) {
      return "Service is healthy";
    }

    return JSON.stringify(errors, null, 2)
  }

  const accordionDisabled = getServiceHealthState(serviceState) === "success";

  return (
    <Accordion.Root disabled={accordionDisabled}>
      <Accordion.Summary
        expandIcon={<ChevronDownIcon sx={{
          color: accordionDisabled ? "grey.400" : "text.primary"
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
          {getCode()}
        </CodeBlock>
      </Accordion.Details>

    </Accordion.Root>
  )
}

interface RunServicesAccordionProps {
  replicas: Array<GetProjectServicesHealthQuery["getProjectStatus"]["services"][number]["replicas"]>;
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
  replicas,
  serviceStates,
  icon,
  iconIsComponent = true,
  alt,
}: RunServicesAccordionProps) {


  const getCode = () => {
    if (replicas.every((replica) => replica.every((r) => r.errors.length === 0))) {
      return "Services are healthy";
    }

    const errors = replicas.map((replica) =>
      replica.map((r) => r.errors)
    );

    return JSON.stringify(errors, null, 2)
  }

  const accordionDisabled = serviceStates.every((state) => getServiceHealthState(state) === "success");

  const globalState = findHighestImportanceState(serviceStates)

  return (
    <Accordion.Root disabled={accordionDisabled}>
      <Accordion.Summary
        expandIcon={<ChevronDownIcon sx={{
          color: accordionDisabled ? "grey.400" : "text.primary"
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
              Services
            </Text>
            <Box sx={{
              backgroundColor: serviceStateToColor.get(globalState),
            }} className="rounded-full w-2 h-2" />
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock
        >
          {getCode()}
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
    ...runServices
  } = serviceMap;

  return (<Box className={twMerge('w-full rounded-lg text-left')}>
    <Box sx={{
      borderColor: "text.dark"
    }} className="grid grid-flow-row gap-1 pt-4">
      <ServiceAccordion
        icon={<UserIcon className="w-4 h-4" />}
        serviceName="Auth"
        replicas={auth?.replicas}
        serviceState={auth?.state}
      />
      <ServiceAccordion
        icon={<DatabaseIcon className="w-4 h-4" />}
        serviceName="Postgres"
        replicas={postgres?.replicas}
        serviceState={postgres?.state}
      />
      <ServiceAccordion
        icon={<StorageIcon className="w-4 h-4" />}
        serviceName="Storage"
        replicas={storage?.replicas}
        serviceState={storage?.state}
      />
      <ServiceAccordion
        icon={<HasuraIcon className="w-4 h-4" />}
        serviceName="Hasura"
        replicas={hasura?.replicas}
        serviceState={hasura?.state}
      />
      {ai ? (
        <ServiceAccordion
          icon={<AIIcon className="w-4 h-4" />}
          serviceName="AI"
          replicas={ai.replicas}
          serviceState={ai.state}
        />
      ) : null}
      {Object.values(runServices).length > 0 ? (
        <RunServicesAccordion
          icon={<ServicesOutlinedIcon className="w-4 h-4" />}
          replicas={Object.values(runServices).map((service) => service.replicas)}
          serviceStates={Object.values(runServices).map((service) => service.state)}
        />
      )
        : null}
    </Box>
  </Box>
  );
}