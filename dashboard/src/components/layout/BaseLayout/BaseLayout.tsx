import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { useTheme } from '@mui/material';
import type { NextSeoProps } from 'next-seo';
import { NextSeo } from 'next-seo';
import type { PropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

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
  className,
  ...props
}: BaseLayoutProps) {
  const theme = useTheme();

  return (
    <Box className={twMerge(theme.palette.mode, className)} {...props}>
      <NextSeo title={title} {...seoProps} />

      {children}
    </Box>
  );
}
