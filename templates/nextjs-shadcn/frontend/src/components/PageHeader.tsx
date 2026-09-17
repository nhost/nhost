import type { ReactNode } from 'react';

/**
 * Title and standfirst for a top-level page.
 *
 * The description reserves two lines whether or not it needs them, so the
 * content below starts at the same height on every page and does not jump
 * when you navigate between them.
 */
export function PageHeader({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-bold text-4xl tracking-tight">{title}</h1>
      <p className="min-h-14 max-w-2xl text-lg text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
