import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { CronTriggerEventsSection } from './cronTriggerEventsDataTableColumns';

interface StatusColumnHeaderProps {
  value: CronTriggerEventsSection;
  onChange: (value: CronTriggerEventsSection) => void;
}

const STATUS_FILTER_OPTIONS: Record<
  CronTriggerEventsSection,
  { label: string; description: string }
> = {
  scheduled: {
    label: 'Scheduled',
    description: 'Scheduled events waiting to run',
  },
  processed: {
    label: 'Processed',
    description: 'Delivered, Error, or Dead events',
  },
  failed: {
    label: 'Failed',
    description: 'Error or Dead events',
  },
  all: {
    label: 'All',
    description: 'All events',
  },
};

export default function StatusColumnHeader({
  value,
  onChange,
}: StatusColumnHeaderProps) {
  const { label } = STATUS_FILTER_OPTIONS[value];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          type="button"
          className="relative flex h-fit items-center justify-between p-2 font-bold text-foreground text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors dark:hover:bg-[#21262d]"
          aria-label={`Filter events by ${label.toLowerCase()} status`}
        >
          <span className="truncate">Status</span>
          <span className="flex items-center pl-1 font-normal text-muted-foreground">
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel>Show events</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(selectedValue) =>
            onChange(selectedValue as CronTriggerEventsSection)
          }
        >
          {Object.entries(STATUS_FILTER_OPTIONS).map(([option, optionMeta]) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="items-start gap-2 py-2"
            >
              <div className="flex flex-col text-left leading-tight">
                <span className="font-medium text-sm">{optionMeta.label}</span>
                <span className="text-muted-foreground text-xs">
                  {optionMeta.description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
