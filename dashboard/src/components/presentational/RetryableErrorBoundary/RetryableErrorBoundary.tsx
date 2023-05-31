import type { ErrorMessageProps } from '@/components/presentational/ErrorMessage';
import { ErrorMessage } from '@/components/presentational/ErrorMessage';
import type { PropsWithChildren } from 'react';
import type {
  ErrorBoundaryPropsWithRender,
  FallbackProps,
} from 'react-error-boundary';
import { ErrorBoundary } from 'react-error-boundary';
import { twMerge } from 'tailwind-merge';

export interface RetryableErrorBoundaryProps
  extends PropsWithChildren<
    Omit<ErrorBoundaryPropsWithRender, 'fallbackRender'>
  > {
  errorMessageProps?: Omit<ErrorMessageProps, 'onReset'>;
}

function RetryableErrorBoundaryFallback({
  error,
  resetErrorBoundary,
  className,
  ...props
}: FallbackProps & RetryableErrorBoundaryProps['errorMessageProps']) {
  return (
    <ErrorMessage
      className={twMerge('mx-auto w-full max-w-7xl px-10 pt-4', className)}
      onReset={resetErrorBoundary}
      {...props}
    >
      {error.message}
    </ErrorMessage>
  );
}

export default function RetryableErrorBoundary({
  children,
  errorMessageProps,
  ...props
}: RetryableErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallbackRender={(fallbackProps) =>
        RetryableErrorBoundaryFallback({
          ...fallbackProps,
          ...errorMessageProps,
        })
      }
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}
