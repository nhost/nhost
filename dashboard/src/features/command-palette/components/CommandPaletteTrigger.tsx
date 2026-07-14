import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { CommandShortcut } from '@/components/ui/v3/command';
import { useCommandPaletteOpen } from '@/features/command-palette/components/CommandPaletteProvider';
import { cn } from '@/lib/utils';

export interface CommandPaletteTriggerProps {
  variant?: 'box' | 'icon';
  className?: string;
  onClick?: VoidFunction;
}

export const CommandPaletteTrigger = ({
  variant = 'box',
  className,
  onClick,
}: CommandPaletteTriggerProps) => {
  const { openCommandPalette } = useCommandPaletteOpen();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPod|iPad/i.test(navigator.userAgent));
  }, []);

  const handleClick = () => {
    onClick?.();
    openCommandPalette();
  };

  if (variant === 'icon') {
    return (
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Open command palette"
        className={cn('text-muted-foreground', className)}
        onClick={handleClick}
        size="icon"
        variant="outline"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      aria-keyshortcuts="Meta+K Control+K"
      aria-label="Open command palette"
      className={cn(
        'justify-start gap-2 px-3 font-normal text-muted-foreground',
        className,
      )}
      onClick={handleClick}
      variant="outline"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Search…</span>
      <CommandShortcut>{isMac ? '⌘K' : 'Ctrl K'}</CommandShortcut>
    </Button>
  );
};
