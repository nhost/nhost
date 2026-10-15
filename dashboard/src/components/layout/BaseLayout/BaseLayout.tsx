import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { PageTitle } from '@/components/common/PageTitle';

export interface BaseLayoutProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Title of the page.
   */
  title?: string;
}

// TODO: Refactor modal management to utilize `DialogProvider` instead.
export default function BaseLayout({
  children,
  title,
  className,
  ...props
}: BaseLayoutProps) {
  return (
    <div className={twMerge('box', className)} {...props}>
      {title ? <PageTitle title={title} /> : null}

      {children}
    </div>
  );
}
