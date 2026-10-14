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
      variant="subtle"
    >
      <Search />
    </Button>
  );
}
