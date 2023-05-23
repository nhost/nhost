import { RetryableErrorBoundary } from '@/components/common/RetryableErrorBoundary';
import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import type { AccountSettingsSidebarProps } from '@/features/account/settings/components/AccountSettingsSidebar';
import { AccountSettingsSidebar } from '@/features/account/settings/components/AccountSettingsSidebar';
import type { BoxProps } from '@/ui/v2/Box';
import { Box } from '@/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export interface AccountSettingsLayoutProps extends AuthenticatedLayoutProps {
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the main container.
     */
    main?: BoxProps;
    /**
     * Props passed to the sidebar.
     */
    sidebar?: AccountSettingsSidebarProps;
  };
}

export default function AccountSettingsLayout({
  children,
  slotProps = {},
  ...props
}: AccountSettingsLayoutProps) {
  return (
    <AuthenticatedLayout {...props}>
      <Box
        component="main"
        className={twMerge(
          'relative flex h-full flex-auto overflow-y-auto',
          slotProps?.main?.className,
        )}
      >
        <AccountSettingsSidebar
          {...slotProps?.sidebar}
          className={twMerge(
            'w-full max-w-sidebar',
            slotProps?.sidebar?.className,
          )}
        />

        <Box
          sx={{ backgroundColor: 'background.default' }}
          className="flex w-full flex-auto flex-col overflow-x-hidden"
        >
          <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
        </Box>
      </Box>
    </AuthenticatedLayout>
  );
}
