import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import type { MetricPanelSlug } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';

export interface ExpandablePanelCardProps {
  title: string;
  description?: string;
  slug?: MetricPanelSlug;
  expandable?: boolean;
  onExpand?: (slug: MetricPanelSlug) => void;
  children: ReactNode;
}

export default function ExpandablePanelCard({
  title,
  description,
  slug,
  expandable = true,
  onExpand,
  children,
}: ExpandablePanelCardProps) {
  const canExpand = expandable && !!slug && !!onExpand;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-h-10 space-y-1">
          <h3 className="font-medium text-foreground text-sm">{title}</h3>
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onExpand(slug)}
            aria-label={`Expand ${title}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
