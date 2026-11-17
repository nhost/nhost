import {
  SettingsCard,
  type SettingsCardProps,
} from '@/components/layout/SettingsCard';
import { cn } from '@/lib/utils';

export default function AccountSettingsCard({
  className,
  ...props
}: SettingsCardProps) {
  return (
    <SettingsCard
      className={cn('border-border bg-background', className)}
      {...props}
    />
  );
}
