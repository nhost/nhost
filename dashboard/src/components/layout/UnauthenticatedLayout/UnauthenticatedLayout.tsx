import { LoadingScreen } from '@/components/common/LoadingScreen';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import BaseLayout from '@/components/layout/BaseLayout';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCleanWorkspaceContext } from '@/hooks/use-cleanWorkspaceContext';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export interface UnauthenticatedLayoutProps extends BaseLayoutProps {}

export default function UnauthenticatedLayout({
  children,
  ...props
}: UnauthenticatedLayoutProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  useCleanWorkspaceContext();

  useEffect(() => {
    if (!isPlatform || (!isLoading && isAuthenticated)) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router, isPlatform]);

  if (!isPlatform || isLoading || isAuthenticated) {
    return (
      <BaseLayout {...props}>
        <LoadingScreen />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout {...props}>
      <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
    </BaseLayout>
  );
}
