import { Search } from 'lucide-react';

import { Button } from '@/components/ui/v3/button';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import { useCommandPalette } from '@/features/command-palette/hooks/useCommandPalette';

export default function CommandPaletteIconTrigger() {
  const { openCommandPalette, paletteProps } = useCommandPalette();

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Open command palette"
        onClick={openCommandPalette}
        size="icon"
        variant="ghost"
      >
        <Search className="h-4 w-4" />
      </Button>
      <CommandPalette {...paletteProps} />
    </>
  );
}
