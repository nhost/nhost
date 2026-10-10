import { Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/v3/button';
import { CommandShortcut } from '@/components/ui/v3/command';
import { cn } from '@/lib/utils';

export interface CommandPaletteTriggerProps {
  className?: string;
  onOpen: VoidFunction;
}

const subscribeToUserAgent = (_onStoreChange: VoidFunction) => () => {};
const getIsMacSnapshot = () =>
  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
const getIsMacServerSnapshot = () => false;

export default function CommandPaletteTrigger({
  className,
  onOpen,
}: CommandPaletteTriggerProps) {
  const isMac = useSyncExternalStore(
    subscribeToUserAgent,
    getIsMacSnapshot,
    getIsMacServerSnapshot,
  );

  return (
    <Button
      aria-keyshortcuts="Meta+K Control+K"
      aria-label="Open command palette"
      className={cn(
        'h-8 justify-start gap-2 border border-transparent bg-neutral-100 px-3 font-normal text-neutral-500 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-500 focus-visible:border-neutral-300 focus-visible:bg-white dark:bg-muted dark:text-muted-foreground dark:focus-visible:border-ring dark:focus-visible:bg-accent dark:hover:border-border dark:hover:bg-muted',
        className,
      )}
      onClick={onOpen}
      variant="outline"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">Search or navigate to...</span>
      <CommandShortcut className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 tracking-normal dark:border-border dark:bg-accent dark:text-muted-foreground">
        {isMac ? '⌘K' : 'Ctrl K'}
      </CommandShortcut>
    </Button>
  );
}
