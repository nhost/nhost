'use client';

import { useSearchParams } from 'next/navigation';
import AuthErrorNotice from '@/components/AuthErrorNotice';

/** Shows `AuthErrorNotice` for the current URL, on any page. */
export default function AuthErrorFromUrl() {
  const params = useSearchParams();
  const error = params.get('error');

  if (!error) {
    return null;
  }

  return (
    <div className="mx-auto mb-4 max-w-sm">
      <AuthErrorNotice error={error} />
    </div>
  );
}
