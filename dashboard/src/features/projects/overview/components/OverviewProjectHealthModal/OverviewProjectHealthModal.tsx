import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { QuestionMarkIcon } from '@/components/ui/v2/icons/QuestionMarkIcon';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import {
  findHighestImportanceState,
  serviceStateToThemeColor,
  type baseServices,
  type ServiceHealthInfo,
} from '@/features/projects/overview/health';
import { removeTypename } from '@/utils/helpers';
import {
  ServiceState,
  type GetProjectServicesHealthQuery,
} from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';

interface ServiceAccordionProps {
  serviceName: string;
  serviceHealth: ServiceHealthInfo;
  replicas: ServiceHealthInfo['replicas'];
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
  defaultExpanded?: boolean;
}

function ServiceAccordion({
  serviceName,
  serviceHealth,
  replicas,
  serviceState,
  icon,
  iconIsComponent = true,
  alt,
  defaultExpanded = false,
}: ServiceAccordionProps) {
  const unknownState = serviceState === undefined;

  const serviceInfo = removeTypename(serviceHealth);

  const replicasLabel = replicas?.length === 1 ? 'replica' : 'replicas';

  const blink = serviceState === ServiceState.Updating;

  return (
    <Accordion.Root defaultExpanded={defaultExpanded}>
      <Accordion.Summary
        expandIcon={
          <ChevronDownIcon
            sx={{
              color: 'text.primary',
            }}
          />
        }
        aria-controls="panel1-content"
        id="panel1-header"
        className="px-6"
      >
        <div className="flex flex-row justify-between gap-2 py-2">
          <div className="flex items-center gap-3">
            {iconIsComponent
              ? icon
              : typeof icon === 'string' && <Image src={icon} alt={alt} />}
            <Text
              sx={{ color: 'text.primary' }}
              variant="h4"
              className="font-semibold"
            >
              {serviceName}{' '}
              {!unknownState && replicas?.length && replicasLabel ? (
                <Text
                  sx={{
                    color: 'text.secondary',
                  }}
                  component="span"
                  className="font-semibold"
                >
                  ({replicas.length} {replicasLabel})
                </Text>
              ) : null}
            </Text>
            {serviceState === ServiceState.Running || unknownState ? (
              <Box
                sx={{
                  backgroundColor: serviceStateToThemeColor.get(serviceState),
                }}
                className="flex h-2.5 w-2.5 items-center justify-center rounded-full"
              >
                {serviceState === ServiceState.Running ? (
                  <CheckIcon
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                    }}
                    className="h-3/4 w-3/4 stroke-2"
                  />
                ) : (
                  <QuestionMarkIcon
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                    }}
                    className="h-3/4 w-3/4 stroke-2"
                  />
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  backgroundColor: serviceStateToThemeColor.get(serviceState),
                }}
                className={`h-2.5 w-2.5 rounded-full ${
                  blink ? 'animate-pulse' : ''
                }`}
              />
            )}
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock copyToClipboardToastTitle={`${serviceName} status`}>
          {JSON.stringify(serviceInfo, null, 2)}
        </CodeBlock>
      </Accordion.Details>
    </Accordion.Root>
  );
}

interface RunServicesAccordionProps {
  servicesHealth: Array<ServiceHealthInfo>;
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
  defaultExpanded?: boolean;
}

function RunServicesAccordion({
  serviceStates,
  servicesHealth,
  icon,
  iconIsComponent = true,
  defaultExpanded = false,
  alt,
}: RunServicesAccordionProps) {
  const unknownState = serviceStates.includes(undefined);

  const globalState = findHighestImportanceState(serviceStates);

  const serviceInfo = removeTypename(servicesHealth);

  const blink = globalState === ServiceState.Updating;

  return (
    <Accordion.Root defaultExpanded={defaultExpanded}>
      <Accordion.Summary
        expandIcon={
          <ChevronDownIcon
            sx={{
              color: 'text.primary',
            }}
          />
        }
        aria-controls="panel1-content"
        id="panel1-header"
        className="px-6"
      >
        <div className="flex flex-row justify-between gap-2 py-2">
          <div className="flex items-center gap-3">
            {iconIsComponent
              ? icon
              : typeof icon === 'string' && <Image src={icon} alt={alt} />}
            <Text
              sx={{ color: 'text.primary' }}
              variant="h4"
              className="font-semibold"
            >
              Run
            </Text>

            {globalState === ServiceState.Running || unknownState ? (
              <Box
                sx={{
                  backgroundColor: serviceStateToThemeColor.get(globalState),
                }}
                className="flex h-2.5 w-2.5 items-center justify-center rounded-full"
              >
                {globalState === ServiceState.Running ? (
                  <CheckIcon
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                    }}
                    className="h-3/4 w-3/4 stroke-2"
                  />
                ) : (
                  <QuestionMarkIcon
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? 'grey.200' : 'grey.100',
                    }}
                    className="h-3/4 w-3/4 stroke-2"
                  />
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  backgroundColor: serviceStateToThemeColor.get(globalState),
                }}
                className={`h-2.5 w-2.5 rounded-full ${
                  blink ? 'animate-pulse' : ''
                }`}
              />
            )}
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock copyToClipboardToastTitle="Run services status">
          {JSON.stringify(serviceInfo, null, 2)}
        </CodeBlock>
      </Accordion.Details>
    </Accordion.Root>
  );
}

export interface OverviewProjectHealthModalProps {
  servicesHealth?: GetProjectServicesHealthQuery;
  defaultExpanded?: keyof typeof baseServices | 'run';
}

export default function OverviewProjectHealthModal({
  servicesHealth,
  defaultExpanded,
}: OverviewProjectHealthModalProps) {
  const serviceMap: { [key: string]: ServiceHealthInfo | undefined } = {};
  servicesHealth.getProjectStatus.services.forEach((service) => {
    serviceMap[service.name] = service;
  });
  const {
    'hasura-auth': auth,
    'hasura-storage': storage,
    postgres,
    hasura,
    ai,
    ...otherServices
  } = serviceMap;

  const runServices = Object.values(otherServices).filter((service) =>
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
        {Object.values(runServices).length > 0 ? (
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
