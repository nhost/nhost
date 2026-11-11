import { Badge } from '@/components/ui/v3/badge';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { Organization_Status_Enum } from '@/generated/graphql';
import { cn } from '@/lib/utils';

const PLAN_TONES: Record<string, string> = {
  Starter: 'border-foreground/15 bg-foreground/[0.06] text-foreground/80',
  Pro: 'border-primary/20 bg-primary/[0.07] text-primary',
  Team: 'border-brand-violet/20 bg-brand-violet/[0.08] text-brand-violet',
  Enterprise: 'border-warning/20 bg-warning/[0.08] text-warning-foreground',
  Legacy: 'border-transparent bg-warning/20 text-foreground',
};

const CANCELLED_TONE =
  'border-destructive/30 bg-destructive/10 text-destructive';

export interface OrganizationPlanBadgeProps {
  plan?: string | null;
  /** A cancelled organization shows "Cancelled" in place of its plan. */
  status?: Organization_Status_Enum | null;
}

export default function OrganizationPlanBadge({
  plan: planName,
  status,
}: OrganizationPlanBadgeProps) {
  const isPlatform = useIsPlatform();

  if (!isPlatform) {
    return null;
  }

  const isCancelled = status === Organization_Status_Enum.Cancelled;
  const plan = planName ?? 'Legacy';
  let label = plan;
  let tone = plan.startsWith('Enterprise')
    ? PLAN_TONES.Enterprise
    : PLAN_TONES[plan];
  if (isCancelled) {
    label = 'Cancelled';
    tone = CANCELLED_TONE;
  }

  return (
    <Badge
      variant="outline"
      className={cn(tone, 'ml-2 h-5 shrink-0 px-1.5 text-2xs')}
    >
      {label}
    </Badge>
  );
}
