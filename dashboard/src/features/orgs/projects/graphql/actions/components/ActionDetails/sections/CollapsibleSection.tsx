import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  action,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded border">
      <div className="relative flex items-center">
        <CollapsibleTrigger className="flex w-full items-center gap-2 p-4 text-left hover:bg-muted [&[data-state=open]>svg]:rotate-90">
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
          <h3 className="font-medium text-base text-foreground">{title}</h3>
        </CollapsibleTrigger>
        {action ? (
          <div className="absolute top-1/2 right-4 -translate-y-1/2">
            {action}
          </div>
        ) : null}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
