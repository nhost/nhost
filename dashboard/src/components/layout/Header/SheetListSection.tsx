import type { ReactNode } from 'react';

export interface SheetListSectionProps {
  label: string;
  children: ReactNode;
}

export default function SheetListSection({
  label,
  children,
}: SheetListSectionProps) {
  return (
    <section aria-label={label} className="p-2">
      <h2 className="px-3 pt-3 pb-2 font-semibold text-2xs text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </h2>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}
