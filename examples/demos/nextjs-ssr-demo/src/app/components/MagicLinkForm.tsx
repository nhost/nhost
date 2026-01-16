'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

interface MagicLinkFormProps {
  sendMagicLinkAction: (formData: FormData) => Promise<{
    redirect?: string;
    error?: string;
  }>;
  showDisplayName?: boolean;
  buttonLabel?: string;
}

export default function MagicLinkForm({
  sendMagicLinkAction,
  showDisplayName = false,
  buttonLabel = 'Sign in with Magic Link',
}: MagicLinkFormProps) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const displayNameId = useId();
  const emailId = useId();

  const handleSubmit = async (formData: FormData) => {
    try {
      const result = await sendMagicLinkAction(formData);

      if (result.redirect) {
        router.push(result.redirect);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to send magic link',
      );
    }
  };

  return (
    <form action={handleSubmit} className="w-full space-y-5">
      {showDisplayName && (
        <div>
          <label htmlFor={displayNameId}>Display Name</label>
          <input
            id={displayNameId}
            name="displayName"
            type="text"
            required={showDisplayName}
          />
        </div>
      )}

      <div>
        <label htmlFor={emailId}>Email</label>
        <input id={emailId} name="email" type="email" required />
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <button type="submit" className="btn btn-primary w-full">
        {buttonLabel}
      </button>
    </form>
  );
}
