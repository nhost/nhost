import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PermissionSettingsSectionV3Props {
  title: ReactNode;
  className?: string;
  children?: ReactNode;
}

export default function PermissionSettingsSectionV3({
  title,
  className,
  children,
}: PermissionSettingsSectionV3Props) {
  return (
    <section className="border-y-1 bg-white dark:bg-[#171d26]">
      <h2 className="px-6 py-3 font-bold text-sm+">{title}</h2>
      <div
        className={cn(
          'grid grid-flow-row items-center gap-4 border-t-1 px-6 py-4 text-sm+',
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
