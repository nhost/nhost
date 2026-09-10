import type { HTMLAttributes } from 'react';
import {
  StandaloneLayout,
  type StandaloneLayoutProps,
} from '@/components/layout/StandaloneLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';
import { cn } from '@/lib/utils';

export interface AccountSettingsLayoutProps extends StandaloneLayoutProps {
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
    <StandaloneLayout {...props}>
      <AuthGuard>
        <div
          {...mainProps}
          className={cn(
            'relative flex h-full flex-auto overflow-y-auto',
            mainClassName,
          )}
        >
          <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background-default">
            <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
          </div>
        </div>
      </AuthGuard>
    </StandaloneLayout>
  );
}
