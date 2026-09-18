import { useRouter } from 'next/router';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface ProjectSectionLayoutProps
  extends ComponentPropsWithoutRef<'div'> {
  navigation?: ReactNode;
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
  const { asPath } = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  // This pane doesn't remount when switching between tabs on the same
  // page (e.g. Settings' General <-> Environment Variables, which are
  // just a `tab` query param on one page component), so without this its
  // scroll position carries over from whatever tab you were on before,
  // making the new tab open already scrolled past its own title. Reset
  // it to the top on every route/tab change instead.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [asPath]);

  return (
    <div
      className={cn('flex h-full min-w-0 flex-col overflow-hidden', className)}
      {...props}
    >
      {navigation && (
        <div className={cn('shrink-0 border-b px-4 py-3', navigationClassName)}>
          {navigation}
        </div>
      )}

      <div
        className={cn(
          'relative flex min-h-0 flex-1 overflow-hidden',
          bodyClassName,
        )}
      >
        {sidebar}
        <div
          ref={contentRef}
          className={cn(
            'relative min-w-0 flex-1 overflow-y-auto pt-8 pb-8',
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
