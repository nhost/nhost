import Image from 'next/image';
import type { ReactElement } from 'react';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { AccordionHealthBadge } from '@/features/orgs/projects/overview/components/AccordionHealthBadge';
import { ServiceState } from '@/generated/graphql';

export interface ServiceAccordionProps {
  serviceName: string;
  serviceInfo: string;
  replicaCount?: number;
  serviceState?: ServiceState;
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
  const showReplicaCount =
    !unknownState && replicaCount !== undefined && replicaCount > 0;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultExpanded ? serviceName : undefined}
    >
      <AccordionItem value={serviceName} className="border-b-0">
        <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <div className="flex flex-row justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              {iconIsComponent
                ? icon
                : typeof icon === 'string' && (
                    <Image src={icon} alt={alt || ''} width={16} height={16} />
                  )}
              <span className="font-semibold text-base text-foreground">
                {serviceName}{' '}
                {showReplicaCount ? (
                  <span className="font-semibold text-muted-foreground">
                    ({replicaCount} {replicasLabel})
                  </span>
                ) : null}
              </span>
              <AccordionHealthBadge
                serviceState={serviceState}
                unknownState={unknownState}
                blink={blink}
              />
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6">
          <CodeBlock copyToClipboardToastTitle={`${serviceName} status`}>
            {serviceInfo}
          </CodeBlock>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
