import type { NextSeoProps } from 'next-seo';
import { NextSeo } from 'next-seo';
import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface BaseLayoutProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Title of the page.
   */
  title?: string;
  /**
   * Props to be passed to the internal `NextSeo` component.
   */
  seoProps?: NextSeoProps;
}

// TODO: Refactor modal management to utilize `DialogProvider` instead.
export default function BaseLayout({
  children,
  title,
  seoProps,
  className,
  ...props
}: BaseLayoutProps) {
  return (
    <div className={twMerge('box', className)} {...props}>
      <NextSeo title={title} {...seoProps} />

      {children}
    </div>
  );
}
