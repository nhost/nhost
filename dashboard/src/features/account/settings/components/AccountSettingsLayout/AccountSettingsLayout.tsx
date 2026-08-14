import type { HTMLAttributes } from 'react';
import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { cn } from '@/lib/utils';

export interface AccountSettingsLayoutProps extends AuthenticatedLayoutProps {
  slotProps?: {
    main?: HTMLAttributes<HTMLElement>;
  };
}

export default function AccountSettingsLayout({
  children,
  slotProps = {},
  ...props
}: AccountSettingsLayoutProps) {
  const { className: mainClassName, ...mainProps } = slotProps.main ?? {};

  return (
    <AuthenticatedLayout {...props}>
      <main
        {...mainProps}
        className={cn(
          'relative flex h-full flex-auto overflow-y-auto',
          mainClassName,
        )}
      >
        <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background-default">
          <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
