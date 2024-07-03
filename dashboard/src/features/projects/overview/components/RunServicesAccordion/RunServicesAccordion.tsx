import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { Box } from '@/components/ui/v2/Box';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { QuestionMarkIcon } from '@/components/ui/v2/icons/QuestionMarkIcon';
import { Text } from '@/components/ui/v2/Text';
import {
  findHighestImportanceState,
  serviceStateToThemeColor,
  type ServiceHealthInfo,
} from '@/features/projects/overview/health';
import { removeTypename } from '@/utils/helpers';
import { ServiceState } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { type ReactElement } from 'react';

export interface RunServicesAccordionProps {
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

export default function RunServicesAccordion({
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
