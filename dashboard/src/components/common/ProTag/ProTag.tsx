import { PLAN_TONES } from '@/components/layout/Header/OrganizationPlanBadge';
import { Badge } from '@/components/ui/v3/badge';
import { cn } from '@/lib/utils';

export default function ProTag() {
  return (
    <Badge
      variant="outline"
      className={cn(
        PLAN_TONES.Pro,
        'ml-1.5 h-5 shrink-0 px-1.5 text-2xs hover:bg-primary/[0.07]',
      )}
    >
      Pro
    </Badge>
  );
}
