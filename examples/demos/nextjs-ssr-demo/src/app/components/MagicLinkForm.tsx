"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  buttonLabel = "Sign in with Magic Link",
}: MagicLinkFormProps) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        err instanceof Error ? err.message : "Failed to send magic link",
      );
    }
  };

  return (
    <form action={handleSubmit} className="w-full space-y-5">
      {showDisplayName && (
        <div>
          <label htmlFor="magic-displayName">Display Name</label>
          <input
            id="magic-displayName"
            name="displayName"
            type="text"
            required={showDisplayName}
          />
        </div>
      )}

      <div>
        <label htmlFor="magic-email">Email</label>
        <input id="magic-email" name="email" type="email" required />
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <button type="submit" className="btn btn-primary w-full">
        {buttonLabel}
      </button>
    </form>
  );
}
