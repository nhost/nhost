import type { ReactNode } from 'react';

interface CronJobPaneHeaderProps {
  title: string;
  description?: string;
  actions: ReactNode;
  children: ReactNode;
}

export default function CronJobPaneHeader({
  title,
  description,
  actions,
  children,
}: CronJobPaneHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-xl">{title}</h1>
          {description?.trim() && (
            <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="px-6">{children}</div>
    </header>
  );
}
