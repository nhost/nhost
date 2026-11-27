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
    <header className="sticky top-0 z-10 border-transparent border-b bg-background/80 shadow-none backdrop-blur-md backdrop-saturate-150 transition-[box-shadow,border-color] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-1 before:h-2 before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:opacity-0 before:blur-sm before:transition-opacity before:duration-200 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-foreground/30 after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 group-data-[scrolled=true]/pane:border-border group-data-[scrolled=true]/pane:shadow-sticky group-data-[scrolled=true]/pane:after:opacity-100 group-data-[scrolled=true]/pane:before:opacity-100 motion-reduce:transition-none">
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
