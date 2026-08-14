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
      className={cn(
        "border-[#EAEDF0] bg-white font-['Inter_var'] dark:border-[#2F363D] dark:bg-paper",
        className,
      )}
      {...props}
    />
  );
}
