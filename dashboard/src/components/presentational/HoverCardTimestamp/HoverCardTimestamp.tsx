import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/v3/hover-card';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';
import { HoverCardPortal } from '@radix-ui/react-hover-card';
import { format } from 'date-fns';
import { Copy } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

type HoverCardContentProps = ComponentPropsWithoutRef<typeof HoverCardContent>;

interface HoverCardTimestampProps {
  date: Date;
  side?: HoverCardContentProps['side'];
  sideOffset?: HoverCardContentProps['sideOffset'];
  align?: HoverCardContentProps['align'];
  alignOffset?: HoverCardContentProps['alignOffset'];
  className?: string;
}

function Row({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="group flex items-center justify-between gap-4 text-sm"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        copy(value, 'Timestamp');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          e.preventDefault();
          copy(value, 'Timestamp');
        }
      }}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 truncate font-mono">
        <span className="invisible group-hover:visible">
          <Copy className="h-3 w-3" />
        </span>
        {value}
      </dd>
    </div>
  );
}

export default function HoverCardTimestamp({
  date,
  side = 'right',
  align = 'start',
  alignOffset = -4,
  sideOffset,
  className,
}: HoverCardTimestampProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <HoverCard openDelay={0} closeDelay={150}>
      <HoverCardTrigger asChild>
        <div className={cn('whitespace-nowrap font-mono', className)}>
          {format(date, 'LLL dd, y HH:mm:ss')}
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          className="z-10 w-auto p-2"
          {...{ side, align, alignOffset, sideOffset }}
        >
          <dl className="flex flex-col gap-1">
            <Row value={String(date.getTime())} label="Timestamp" />
            <Row value={date.toISOString()} label="UTC" />
            <Row value={format(date, 'LLL dd, y HH:mm:ss')} label={timezone} />
          </dl>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
