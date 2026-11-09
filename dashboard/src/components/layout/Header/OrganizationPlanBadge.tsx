import { Badge } from '@/components/ui/v3/badge';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { cn } from '@/lib/utils';

// One tone per plan tier so Starter, Pro, Team and Enterprise read as
// visually distinct at a glance.
const PLAN_TONES: Record<string, string> = {
  Starter: 'border-foreground/15 bg-foreground/[0.06] text-foreground/80',
  Pro: 'border-primary/20 bg-primary/[0.07] text-primary',
  Team: 'border-brand-violet/20 bg-brand-violet/[0.08] text-brand-violet',
  Enterprise: 'border-warning/20 bg-warning/[0.08] text-warning-foreground',
  Legacy: 'border-transparent bg-warning/30 text-foreground dark:bg-warning',
};

export interface OrganizationPlanBadgeProps {
  plan?: string | null;
  className?: string;
}

export default function OrganizationPlanBadge({
  plan: planName,
  className,
}: OrganizationPlanBadgeProps) {
  const isPlatform = useIsPlatform();

  if (!isPlatform) {
    return null;
  }

  const plan = planName ?? 'Legacy';
  const tone = plan.startsWith('Enterprise')
    ? PLAN_TONES.Enterprise
    : PLAN_TONES[plan];

  return (
    <Badge
      variant="outline"
      className={cn(tone, 'ml-2 h-5 shrink-0 px-1.5 text-2xs', className)}
    >
      {plan}
    </Badge>
  );
}
