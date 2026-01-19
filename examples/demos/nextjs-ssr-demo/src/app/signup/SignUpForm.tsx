'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { signUp } from './actions';

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
        err instanceof Error ? err.message : 'An error occurred during sign up',
      );
    }
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor={useId()}>Display Name</label>
        <input id={useId()} name="displayName" type="text" required />
      </div>

      <div>
        <label htmlFor={useId()}>Email</label>
        <input id={useId()} name="email" type="email" required />
      </div>

      <div>
        <label htmlFor={useId()}>Password</label>
        <input id={useId()} name="password" type="password" required />
      </div>

      {error && (
        <div className="alert alert-error">
          {typeof error === 'string' ? error : 'Sign up failed'}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full">
        Sign Up
      </button>
    </form>
  );
}
