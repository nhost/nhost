import type { ComponentPropsWithoutRef } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { cn } from '@/lib/utils';

export type ProTagProps = ComponentPropsWithoutRef<typeof Badge>;

/**
 * Small "Pro" pill shown next to a nav item or settings entry that isn't
 * available on the Starter (free) plan. It mirrors the Pro plan badge shown
 * next to the org name in the header (see PLAN_TONES in OrgsComboBox).
 *
 * This is a purely visual label, it doesn't gate anything on its own, the
 * underlying page/action still enforces the actual plan check.
 */
export function ProTag({ className, ...props }: ProTagProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'ml-1.5 h-5 shrink-0 border-primary/20 bg-primary/[0.07] px-[6px] text-[10px] text-primary hover:bg-primary/[0.07]',
        className,
      )}
      {...props}
    >
      Pro
    </Badge>
  );
}
