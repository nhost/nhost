"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "./actions";

interface SignInFormProps {
  initialError?: string;
}

export default function SignInForm({ initialError }: SignInFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
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
    }
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
      </div>

      {error && (
        <div className="alert alert-error">
          {typeof error === "string" ? error : "Sign in failed"}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full">
        Sign In
      </button>
    </form>
  );
}
