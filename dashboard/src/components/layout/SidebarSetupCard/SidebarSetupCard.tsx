import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';

interface SidebarSetupCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: VoidFunction;
  disabled?: boolean;
}

export default function SidebarSetupCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  disabled,
}: SidebarSetupCardProps) {
  return (
    <section className="flex w-full flex-col gap-3 rounded-md bg-muted/40 p-3">
      <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm+">{title}</h3>
        <p className="text-muted-foreground text-xs leading-5">{description}</p>
      </div>
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </section>
  );
}
