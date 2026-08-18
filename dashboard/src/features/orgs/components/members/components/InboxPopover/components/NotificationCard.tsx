import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/v3/badge';

export interface NotificationCardProps {
  label: string;
  timestamp?: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}

export default function NotificationCard({
  label,
  timestamp,
  actions,
  children,
}: NotificationCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge className="hover:bg-primary">{label}</Badge>
        {timestamp && (
          <span className="text-muted-foreground text-xs">{timestamp}</span>
        )}
      </div>
      <p className="text-sm">{children}</p>
      <div className="flex justify-end gap-2">{actions}</div>
    </div>
  );
}
