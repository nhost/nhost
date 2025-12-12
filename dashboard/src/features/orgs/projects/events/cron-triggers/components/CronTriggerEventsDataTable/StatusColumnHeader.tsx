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
import { type CronTriggerEventsSection } from './cronTriggerEventsDataTableColumns';

interface StatusColumnHeaderProps {
  value: CronTriggerEventsSection;
  onChange: (value: CronTriggerEventsSection) => void;
}

const STATUS_FILTER_OPTIONS: Record<
  CronTriggerEventsSection,
  { label: string; description: string }
> = {
  pending: {
    label: 'Pending',
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
};

export default function StatusColumnHeader({
  value,
  onChange,
}: StatusColumnHeaderProps) {
  const { label } = STATUS_FILTER_OPTIONS[value];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-col items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Filter events by ${label.toLowerCase()} status`}
        >
          <span>Status</span>
          <span className="flex items-center gap-1 text-[10px] font-normal capitalize text-muted-foreground">
            {label}
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </span>
        </button>
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
                <span className="text-sm font-medium">{optionMeta.label}</span>
                <span className="text-xs text-muted-foreground">
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
