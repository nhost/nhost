import type { ReactNode } from 'react';

export interface BillingSectionCardProps {
  title: string;
  description: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}

export default function BillingSectionCard({
  title,
  description,
  headerAction,
  children,
}: BillingSectionCardProps) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <h3 className="font-medium text-foreground text-sm">{title}</h3>
          <p className="max-w-prose text-muted-foreground text-xs">
            {description}
          </p>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      {children}
    </section>
  );
}
