"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyMfa } from "../actions";

interface MfaVerificationFormProps {
  ticket: string;
  initialError?: string;
}

export default function MfaVerificationForm({
  ticket,
  initialError,
}: MfaVerificationFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    try {
      const result = await verifyMfa(formData);

      if (result.redirect) {
        router.push(result.redirect);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during verification",
      );
    }
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="ticket" value={ticket} />

      <div>
        <label htmlFor="otp">Verification Code</label>
        <input
          id="otp"
          name="otp"
          type="text"
          placeholder="Enter 6-digit code"
          maxLength={6}
          required
        />
      </div>

      {error && (
        <div className="alert alert-error">
          {typeof error === "string" ? error : "Verification failed"}
        </div>
      )}

      <div className="flex space-x-3">
        <button type="submit" className="btn btn-primary">
          Verify
        </button>

        <Link href="/signin" className="btn btn-secondary">
          Back
        </Link>
      </div>
    </form>
  );
}
