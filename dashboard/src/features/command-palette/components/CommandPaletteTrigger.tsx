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
      size="xs"
      className={cn(
        // Reads as a quiet field, not a button: no fill, a thin border and
        // muted text, so it never competes with the page's real actions.
        'justify-start gap-2 border border-border bg-transparent px-3 font-normal text-muted-foreground shadow-none hover:border-[hsl(var(--foreground)/0.2)] hover:bg-transparent hover:text-foreground active:translate-y-0',
        className,
      )}
      onClick={onOpen}
      variant="ghost"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <CommandShortcut className="font-mono text-[10px] text-muted-foreground tracking-normal">
        {isMac ? '⌘K' : 'Ctrl K'}
      </CommandShortcut>
    </Button>
  );
}
