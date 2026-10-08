import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';

interface NativeQueriesDetailsSectionProps {
  title: string;
  children: ReactNode;
}

export default function NativeQueriesDetailsSection({
  title,
  children,
}: NativeQueriesDetailsSectionProps) {
  return (
    <Collapsible defaultOpen className="rounded border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
        {title}
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
