'use client'

import Input from '@components/input'
import SubmitButton from '@components/submit-button'
import { signInWithPAT } from '@server-actions/auth'
import { useState } from 'react'

export default function SignInWithPAT() {
  const [error, setError] = useState('')

  async function handleSignIn(formData: FormData) {
    const response = await signInWithPAT(formData)

    if (response?.error) {
      setError(response.error)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-semibold text-center">Sign In with Personal Access Token</h1>

      {error && <p className="mt-3 font-semibold text-center text-red-500">{error}</p>}

      <form className="w-full max-w-lg space-y-5" action={handleSignIn}>
        <Input label="PAT" id="pat" name="pat" required />
        <SubmitButton type="submit" className="w-full">
          Sign In
        </SubmitButton>
      </form>
    </div>
  )
}
