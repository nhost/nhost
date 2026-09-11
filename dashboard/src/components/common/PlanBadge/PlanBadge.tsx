import { Badge } from '@/components/ui/v3/badge';
import { cn } from '@/lib/utils';

// One tone per plan tier, each with its own border/background/text color so
// Starter, Pro, Team and Enterprise read as visually distinct at a glance
// instead of all collapsing into the same solid badge.
export const PLAN_TONES: Record<string, string> = {
  Starter: 'border-foreground/15 bg-foreground/[0.06] text-foreground/80',
  Pro: 'border-primary/20 bg-primary/[0.07] text-primary',
  Team: 'border-violet-500/20 bg-violet-500/[0.08] text-violet-600 dark:text-violet-300',
  Enterprise:
    'border-amber-500/20 bg-amber-500/[0.08] text-amber-600 dark:text-amber-300',
};

export interface PlanBadgeProps {
  plan: string;
  className?: string;
}

/**
 * Plan tier badge (Starter/Pro/Team/Enterprise), shared by the org switcher
 * and any other place that needs to show an organization's plan.
 */
export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        PLAN_TONES[plan],
        plan === 'Legacy'
          ? 'border-transparent bg-orange-200 text-foreground hover:bg-orange-200 dark:bg-orange-500'
          : '',
        'hover:none ml-2 h-5 px-[6px] text-[10px]',
        className,
      )}
    >
      {plan}
    </Badge>
  );
}
