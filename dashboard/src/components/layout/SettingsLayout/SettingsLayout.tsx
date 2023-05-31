import type { ProjectLayoutProps } from '@/components/layout/ProjectLayout';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import type { SettingsSidebarProps } from '@/components/layout/SettingsSidebar';
import { SettingsSidebar } from '@/components/layout/SettingsSidebar';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export interface SettingsLayoutProps extends ProjectLayoutProps {
  /**
   * Props passed to the sidebar component.
   */
  sidebarProps?: SettingsSidebarProps;
}

export default function SettingsLayout({
  children,
  mainContainerProps: {
    className: mainContainerClassName,
    ...mainContainerProps
  } = {},
  sidebarProps: { className: sidebarClassName, ...sidebarProps } = {},
  ...props
}: SettingsLayoutProps) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: twMerge('flex h-full', mainContainerClassName),
        ...mainContainerProps,
      }}
      {...props}
    >
      <SettingsSidebar
        className={twMerge('w-full max-w-sidebar', sidebarClassName)}
        {...sidebarProps}
      />

      <Box
        sx={{ backgroundColor: 'background.default' }}
        className="flex w-full flex-auto flex-col overflow-x-hidden"
      >
        <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
      </Box>
    </ProjectLayout>
  );
}
