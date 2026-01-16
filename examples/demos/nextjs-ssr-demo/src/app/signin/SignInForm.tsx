'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { signIn } from './actions';

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
        err instanceof Error ? err.message : 'An error occurred during sign in',
      );
    }
  };

  return (
    <form action={handleSubmit} className="space-y-5">
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
          {typeof error === 'string' ? error : 'Sign in failed'}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full">
        Sign In
      </button>
    </form>
  );
}
