import { Search } from 'lucide-react';

import { Button } from '@/components/ui/v3/button';

export interface CommandPaletteIconTriggerProps {
  onOpen: VoidFunction;
}

export default function CommandPaletteIconTrigger({
  onOpen,
}: CommandPaletteIconTriggerProps) {
  return (
    <Button
      aria-keyshortcuts="Meta+K Control+K"
      aria-label="Open command palette"
      onClick={onOpen}
      size="icon"
      variant="ghost"
    >
      <Search className="h-4 w-4" />
    </Button>
  );
}
