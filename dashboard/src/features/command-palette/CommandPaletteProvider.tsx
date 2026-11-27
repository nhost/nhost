import { createContext, type ReactNode, useContext } from 'react';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import CommandPaletteIconTrigger from '@/features/command-palette/components/CommandPaletteIconTrigger';
import CommandPaletteTrigger from '@/features/command-palette/components/CommandPaletteTrigger';
import { useCommandPalette } from '@/features/command-palette/hooks/useCommandPalette';

const OpenPaletteContext = createContext<VoidFunction | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const { openCommandPalette, paletteProps } = useCommandPalette();
  return (
    <OpenPaletteContext.Provider value={openCommandPalette}>
      {children}
      <CommandPalette {...paletteProps} />
    </OpenPaletteContext.Provider>
  );
}

export function NavigationSearch({
  collapsed = false,
  onSelect,
}: {
  collapsed?: boolean;
  onSelect?: VoidFunction;
}) {
  const open = useContext(OpenPaletteContext);
  if (!open) {
    return null;
  }
  function handleOpen() {
    onSelect?.();
    open?.();
  }
  return collapsed ? (
    <div className="flex justify-center">
      <CommandPaletteIconTrigger onOpen={handleOpen} />
    </div>
  ) : (
    <CommandPaletteTrigger className="w-full" onOpen={handleOpen} />
  );
}
