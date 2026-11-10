import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { SheetClose } from '@/components/ui/v3/sheet';
import { cn } from '@/lib/utils';

export interface SheetListItemProps {
  children: ReactNode;
  current?: boolean;
  onClick: VoidFunction;
}

export default function SheetListItem({
  children,
  current,
  onClick,
}: SheetListItemProps) {
  return (
    <li>
      <SheetClose asChild>
        <button
          type="button"
          aria-current={current ? 'true' : undefined}
          onClick={onClick}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
            current && 'bg-muted font-medium',
          )}
        >
          {children}
          {current && <Check className="ml-auto size-4 shrink-0" />}
        </button>
      </SheetClose>
    </li>
  );
}
