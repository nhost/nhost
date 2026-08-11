import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { getServiceStyle } from '@/features/orgs/projects/logs/components/LogsBody/serviceStyle';
import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface LogsDetailSheetProps {
  entry: LogEntry | null;
  onClose: () => void;
}

function formatLog(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return raw;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return raw;
  }
}

export default function LogsDetailSheet({
  entry,
  onClose,
}: LogsDetailSheetProps) {
  const open = entry !== null;
  const style = entry ? getServiceStyle(entry.service) : null;
  const formatted = entry ? formatLog(entry.log) : '';

  return (
    <Sheet
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex w-[600px] flex-col gap-4 text-base text-foreground sm:max-w-[90vw]"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Log entry</SheetTitle>
          <SheetDescription className="sr-only">
            Detailed view of the selected log entry, including its timestamp,
            service, and full message.
          </SheetDescription>
        </SheetHeader>

        {entry && style && (
          <>
            <div className="flex flex-col gap-2 border-b border-divider pb-3 text-base">
              <div className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">Timestamp</span>
                <span className="font-mono text-foreground">
                  {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">Service</span>
                <span
                  title={entry.service}
                  className={cn(
                    'inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 font-mono',
                    style.className,
                  )}
                >
                  {style.label}
                </span>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <CopyToClipboardButton
                textToCopy={formatted}
                title="Log copied"
                className="absolute right-2 top-2 z-10 bg-muted/80 p-1 hover:bg-muted"
              />
              <pre className="h-full overflow-auto rounded border border-divider bg-muted p-3 pr-12 font-mono text-base text-foreground whitespace-pre-wrap break-words">
                {formatted}
              </pre>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
