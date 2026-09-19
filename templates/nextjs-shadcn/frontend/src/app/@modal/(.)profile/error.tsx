'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function InterceptedProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback reset={reset} className="pt-0" headingLevel="h3" />;
}
