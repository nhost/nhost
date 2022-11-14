import ErrorMessage from '@/components/common/ErrorMessage';
import type { FallbackProps } from 'react-error-boundary';

export default function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  return (
    <ErrorMessage onReset={resetErrorBoundary}>{error.message}</ErrorMessage>
  );
}
