import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import React, { type JSX, useId, useState } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";

interface MagicLinkFormProps {
  buttonLabel?: string;
}

export default function MagicLinkForm({
  buttonLabel = "Send Magic Link",
}: MagicLinkFormProps): JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { nhost } = useAuth();
  const emailId = useId();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await nhost.auth.signInPasswordlessEmail({
        email,
        options: {
          redirectTo: `${window.location.origin}/verify`,
        },
      });

      setSuccess(true);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(
        `An error occurred while sending the magic link: ${error.message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <p className="mb-4">Magic link sent! Check your email to sign in.</p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="btn btn-secondary"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={isLoading}
      >
        {isLoading ? "Sending..." : buttonLabel}
      </button>
    </form>
  );
}
