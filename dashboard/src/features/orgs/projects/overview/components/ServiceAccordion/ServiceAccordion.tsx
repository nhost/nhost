import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { Text } from '@/components/ui/v2/Text';
import { AccordionHealthBadge } from '@/features/orgs/projects/overview/components/AccordionHealthBadge';
import { ServiceState } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { type ReactElement } from 'react';

export interface ServiceAccordionProps {
  serviceName: string;
  serviceInfo: string;
  replicaCount: number;
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

export default function ServiceAccordion({
  serviceName,
  serviceInfo,
  replicaCount,
  serviceState,
  icon,
  iconIsComponent = true,
  alt,
  defaultExpanded = false,
}: ServiceAccordionProps) {
  const unknownState = serviceState === undefined;

  const replicasLabel = replicaCount === 1 ? 'replica' : 'replicas';

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
              {!unknownState && replicaCount && replicasLabel ? (
                <Text
                  sx={{
                    color: 'text.secondary',
                  }}
                  component="span"
                  className="font-semibold"
                >
                  ({replicaCount} {replicasLabel})
                </Text>
              ) : null}
            </Text>
            <AccordionHealthBadge
              serviceState={serviceState}
              unknownState={unknownState}
              blink={blink}
            />
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock copyToClipboardToastTitle={`${serviceName} status`}>
          {serviceInfo}
        </CodeBlock>
      </Accordion.Details>
    </Accordion.Root>
  );
}
