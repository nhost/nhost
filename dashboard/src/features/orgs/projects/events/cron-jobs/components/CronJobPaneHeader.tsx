import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/v3/badge';

interface CronJobPaneHeaderProps {
  title: string;
  subtitle: string;
  paused?: boolean;
  actions: ReactNode;
  children: ReactNode;
}

export default function CronJobPaneHeader({
  title,
  subtitle,
  paused,
  actions,
  children,
}: CronJobPaneHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-semibold text-xl">{title}</h1>
            {paused && <Badge variant="outline">Paused</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="px-6">{children}</div>
    </header>
  );
}
