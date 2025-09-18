"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { signUp } from "./actions";

interface SignUpFormProps {
  initialError?: string;
}

export default function SignUpForm({ initialError }: SignUpFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const displayNameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(undefined);

    try {
      const result = await signUp(formData);

      if (result.redirect) {
        router.push(result.redirect);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An error occurred during sign up",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form action={handleSubmit} className="auth-form">
      <div className="auth-form-field">
        <label htmlFor={displayNameId}>Display Name</label>
        <input
          id={displayNameId}
          name="displayName"
          type="text"
          required
          className="auth-input"
        />
      </div>

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
          minLength={8}
          className="auth-input"
        />
        <small className="help-text">Minimum 8 characters</small>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button
        type="submit"
        disabled={isLoading}
        className="auth-button primary"
      >
        {isLoading ? "Creating Account..." : "Sign Up"}
      </button>
    </form>
  );
}
