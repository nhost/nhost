"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { signIn } from "./actions";

interface SignInFormProps {
  initialError?: string;
}

export default function SignInForm({ initialError }: SignInFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const emailId = useId();
  const passwordId = useId();

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(undefined);

    try {
      const result = await signIn(formData);

      if (result.redirect) {
        router.push(result.redirect);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An error occurred during sign in",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form action={handleSubmit} className="auth-form">
      <div className="auth-form-field">
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          className="auth-input"
        />
      </div>

      <div className="auth-form-field">
        <label htmlFor={passwordId}>Password</label>
        <input
          id={passwordId}
          name="password"
          type="password"
          required
          className="auth-input"
        />
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button
        type="submit"
        disabled={isLoading}
        className="auth-button secondary"
      >
        {isLoading ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
}
