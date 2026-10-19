import { Badge } from '@/components/ui/v3/badge';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { cn } from '@/lib/utils';

export interface OrganizationPlanBadgeProps {
  plan?: string | null;
}

export default function OrganizationPlanBadge({
  plan: planName,
}: OrganizationPlanBadgeProps) {
  const isPlatform = useIsPlatform();

  if (!isPlatform) {
    return null;
  }

  const plan = planName ?? 'Legacy';

  return (
    <Badge
      variant={plan === 'Starter' ? 'outline' : 'default'}
      className={cn(
        plan === 'Starter' && 'bg-muted',
        plan === 'Legacy' &&
          'bg-orange-200 text-foreground hover:bg-orange-200 dark:bg-orange-500',
        'hover:none ml-2 h-5 shrink-0 px-[6px] text-[10px]',
      )}
    >
      {plan}
    </Badge>
  );
}
