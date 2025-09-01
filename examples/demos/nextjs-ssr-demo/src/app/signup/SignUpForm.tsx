"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "./actions";

interface SignUpFormProps {
  initialError?: string;
}

export default function SignUpForm({ initialError }: SignUpFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
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
    }
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="displayName">Display Name</label>
        <input id="displayName" name="displayName" type="text" required />
      </div>

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
          {typeof error === "string" ? error : "Sign up failed"}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full">
        Sign Up
      </button>
    </form>
  );
}
