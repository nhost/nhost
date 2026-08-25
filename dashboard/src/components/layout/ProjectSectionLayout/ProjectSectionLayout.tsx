import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ProjectSectionLayoutProps
  extends ComponentPropsWithoutRef<'div'> {
  navigation: ReactNode;
  sidebar?: ReactNode;
  navigationClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
}

export default function ProjectSectionLayout({
  bodyClassName,
  children,
  className,
  contentClassName,
  navigation,
  navigationClassName,
  sidebar,
  ...props
}: ProjectSectionLayoutProps) {
  return (
    <div
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden bg-background-default',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'shrink-0 border-b bg-background-default px-4 py-3',
          navigationClassName,
        )}
      >
        {navigation}
      </div>

      <div
        className={cn(
          'relative flex min-h-0 flex-1 overflow-hidden',
          bodyClassName,
        )}
      >
        {sidebar}
        <div
          className={cn(
            'relative min-w-0 flex-1 overflow-y-auto',
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
