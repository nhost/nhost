'use client';

import { useSearchParams } from 'next/navigation';
import AuthErrorNotice from '@/components/AuthErrorNotice';

/**
 * Shows `AuthErrorNotice` for the current URL, on any page.
 *
 * A failed flow comes back to whatever `redirectTo` it was given: the page the
 * visitor was headed for, `/account` for an email change, the reset page for a
 * password link. The root layout mounts this once so each of those says what
 * went wrong without every page reading the query itself.
 */
export default function AuthErrorFromUrl() {
  const params = useSearchParams();
  const error = params.get('error');

  if (!error) {
    return null;
  }

  return (
    <div className="mx-auto mb-4 max-w-md">
      <AuthErrorNotice
        error={error}
        description={params.get('errorDescription') ?? undefined}
      />
    </div>
  );
}
