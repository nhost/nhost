import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { type GetProjectServicesHealthQuery, ServiceState } from '@/utils/__generated__/graphql';
import { type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import serviceHealthToColor from '../../health/health';
import Image from 'next/image';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';

const testCode = {
  "data": {
    "project": {
      "services": {
        "edges": [
          {
            "node": {
              "name": "service1",
              "health": "HEALTHY",
              "logs": [
                {
                  "message": "Service is healthy",
                  "timestamp": "2021-08-12T10:00:00Z"
                }
              ]
            }
          }
        ]
      }
    }
  }
};

export interface OverviewProjectHealthModalProps {
  close: () => void;
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

  const getCode = (replicas:
    GetProjectServicesHealthQuery["getProjectStatus"]["services"][number]["replicas"]
  ) => {
    const errors = replicas.map((replica) => {
      return replica.errors
    });

    if (errors.every((error) => error.length === 0)) {
      return "Service is healthy";
    }

    return JSON.stringify(errors, null, 2)
  }

  return (
    <Accordion.Root>
      <Accordion.Summary
        expandIcon={<ChevronDownIcon className="text-black" />}
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
            <Box sx={{
              backgroundColor: serviceHealthToColor.get(serviceState),
            }} className="rounded-full w-2 h-2" />
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock
        >
          {getCode(replicas)}
        </CodeBlock>
      </Accordion.Details>

    </Accordion.Root>
  )
}

export default function OverviewProjectHealthModal({
  close,
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
  } = serviceMap;

  return (<Box className={twMerge('w-full rounded-lg text-left')}>
    {/* <Box className="flex justify-center items-center py-2 gap-4">
        <Button
          variant="borderless"
          color="secondary"
          className="absolute right-3 top-5"
          size="small"
          aria-label="Close"
          onClick={close}
          sx={{ padding: (theme) => theme.spacing(0.5), minWidth: 'initial' }}
        >
          <XIcon fontSize="small" />
        </Button>
      </Box> */}
    <div className="grid grid-flow-row gap-1 border-t-1">
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
      { ai ? (
        <ServiceAccordion
          icon={<AIIcon className="w-4 h-4" />}
          serviceName="AI"
          replicas={ai.replicas}
          serviceState={ai.state}
        />
      ) : null}
    </div>
  </Box>
  );
}