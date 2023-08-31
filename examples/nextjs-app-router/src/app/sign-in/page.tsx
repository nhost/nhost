'use client'

import Button from '@components/button'
import Input from '@components/input'
import { useSignInEmailPassword } from '@nhost/nextjs'
import { useRouter } from 'next/navigation'
import { ChangeEvent, SyntheticEvent, useState } from 'react'

export default function SignIn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { signInEmailPassword, isLoading, needsEmailVerification, isError, error, isSuccess } =
    useSignInEmailPassword()

  const handleOnSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    await signInEmailPassword(email, password)
  }

  const disableForm = isLoading || needsEmailVerification

  if (isSuccess) {
    router.push('/protected')
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">Sign In</h1>

      {isError && error && (
        <p className="mt-3 font-semibold text-center text-red-500">{error.message}</p>
      )}

      <form className="space-y-5" onSubmit={handleOnSubmit}>
        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          value={email}
          required
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          disabled={disableForm}
        />

        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          value={password}
          required
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          disabled={disableForm}
        />

        <Button type="submit">Sign In</Button>
      </form>
    </>
  )
}
