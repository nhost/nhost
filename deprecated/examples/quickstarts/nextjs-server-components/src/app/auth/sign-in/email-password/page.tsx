'use client'

import Input from '@components/input'
import SubmitButton from '@components/submit-button'
import { signIn } from '@server-actions/auth'
import { useState } from 'react'

export default function SignInWithEmailAndPassword() {
  const [error, setError] = useState('')

  async function handleSignIn(formData: FormData) {
    const response = await signIn(formData)

    if (response?.error) {
      setError(response.error)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-center">Sign in with email and password</h1>

      {error && <p className="mt-3 font-semibold text-center text-red-500">{error}</p>}

      <form className="w-full max-w-lg space-y-5" action={handleSignIn}>
        <Input label="Email" id="email" name="email" type="email" required />

        <Input label="Password" id="password" name="password" type="password" required />

        <SubmitButton type="submit" className="w-full">
          Sign in
        </SubmitButton>
      </form>
    </div>
  )
}
