import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import type { NextSeoProps } from 'next-seo';
import { NextSeo } from 'next-seo';
import type { PropsWithoutRef } from 'react';

export interface BaseLayoutProps extends PropsWithoutRef<BoxProps> {
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
  sx,
  ...props
}: BaseLayoutProps) {
  return (
    <Box
      sx={[
        { backgroundColor: (theme) => theme.palette.background.paper },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      <NextSeo title={title} {...seoProps} />

      {children}
    </Box>
  );
}
