import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { Text } from '@/components/ui/v2/Text';
import { AccordionHealthBadge } from '@/features/projects/overview/components/AccordionHealthBadge';
import {
  findHighestImportanceState,
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
            <AccordionHealthBadge
              serviceState={globalState}
              unknownState={unknownState}
              blink={blink}
            />
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
