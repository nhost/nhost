import { Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/v3/button';
import { CommandShortcut } from '@/components/ui/v3/command';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import { useCommandPalette } from '@/features/command-palette/hooks/useCommandPalette';
import { cn } from '@/lib/utils';

export interface CommandPaletteTriggerProps {
  className?: string;
}

const subscribeToUserAgent = (_onStoreChange: VoidFunction) => () => {};
const getIsMacSnapshot = () =>
  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
const getIsMacServerSnapshot = () => false;

export default function CommandPaletteTrigger({
  className,
}: CommandPaletteTriggerProps) {
  const isMac = useSyncExternalStore(
    subscribeToUserAgent,
    getIsMacSnapshot,
    getIsMacServerSnapshot,
  );
  const { openCommandPalette, paletteProps } = useCommandPalette();

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Open command palette"
        className={cn(
          'justify-start gap-2 px-3 font-normal text-muted-foreground',
          className,
        )}
        onClick={openCommandPalette}
        variant="outline"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search or navigate to...</span>
        <CommandShortcut>{isMac ? '⌘K' : 'Ctrl K'}</CommandShortcut>
      </Button>
      <CommandPalette {...paletteProps} />
    </>
  );
}
