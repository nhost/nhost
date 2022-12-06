import type { DataBrowserSidebarProps } from '@/components/dataBrowser/DataBrowserSidebar';
import DataBrowserSidebar from '@/components/dataBrowser/DataBrowserSidebar';
import type { ProjectLayoutProps } from '@/components/layout/ProjectLayout';
import ProjectLayout from '@/components/layout/ProjectLayout';
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

      <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-gray-50">
        {children}
      </div>
    </ProjectLayout>
  );
}
