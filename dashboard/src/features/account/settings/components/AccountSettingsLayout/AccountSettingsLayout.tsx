import {
  StandaloneLayout,
  type StandaloneLayoutProps,
} from '@/components/layout/StandaloneLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';

export type AccountSettingsLayoutProps = StandaloneLayoutProps;

export default function AccountSettingsLayout({
  children,
  ...props
}: AccountSettingsLayoutProps) {
  return (
    <StandaloneLayout {...props}>
      <AuthGuard>
        <div className="relative flex h-full flex-auto overflow-y-auto">
          <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background-default">
            <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
          </div>
        </div>
      </AuthGuard>
    </StandaloneLayout>
  );
}
