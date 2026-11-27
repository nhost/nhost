import type { ReactNode } from 'react';

interface SidebarGroupHeaderProps {
  label: string;
  count?: number;
  children?: ReactNode;
}

export default function SidebarGroupHeader({
  label,
  count,
  children,
}: SidebarGroupHeaderProps) {
  return (
    <div className="flex h-8 items-center justify-between pl-2.5">
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
        {count !== undefined && (
          <span className="ml-1.5 font-normal normal-case">{count}</span>
        )}
      </h2>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
