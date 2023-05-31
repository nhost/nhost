import type { ProjectLayoutProps } from '@/components/layout/ProjectLayout';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { Box } from '@/components/ui/v2/Box';
import type { DataBrowserSidebarProps } from '@/features/database/dataGrid/components/DataBrowserSidebar';
import { DataBrowserSidebar } from '@/features/database/dataGrid/components/DataBrowserSidebar';
import { useRouter } from 'next/router';
import { twMerge } from 'tailwind-merge';

export interface DataBrowserLayoutProps extends ProjectLayoutProps {
  /**
   * Props passed to the sidebar component.
   */
  sidebarProps?: DataBrowserSidebarProps;
}

export default function DataBrowserLayout({
  children,
  mainContainerProps: {
    className: mainContainerClassName,
    ...mainContainerProps
  } = {},
  sidebarProps: { className: sidebarClassName, ...sidebarProps } = {},
  ...props
}: DataBrowserLayoutProps) {
  const {
    query: { dataSourceSlug },
  } = useRouter();

  return (
    <ProjectLayout
      mainContainerProps={{
        className: twMerge('flex h-full', mainContainerClassName),
        ...mainContainerProps,
      }}
      {...props}
    >
      {dataSourceSlug === 'default' && (
        <DataBrowserSidebar
          className={twMerge('w-full max-w-sidebar', sidebarClassName)}
          {...sidebarProps}
        />
      )}

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {children}
      </Box>
    </ProjectLayout>
  );
}
