'use client'

import Button from '@components/button'
import Input from '@components/input'
import { useSignUpEmailPassword } from '@nhost/nextjs'
import { useRouter } from 'next/navigation'
import { ChangeEvent, SyntheticEvent, useState } from 'react'

export default function SignUp() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const { signUpEmailPassword, isLoading, isSuccess, needsEmailVerification, isError, error } =
    useSignUpEmailPassword()

  const handleOnSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()

    await signUpEmailPassword(email, password, {
      displayName: `${firstName} ${lastName}`.trim(),
      metadata: {
        firstName,
        lastName
      }
    })
  }

  const disableForm = isLoading || needsEmailVerification

  if (isSuccess) {
    router.push('/protected')
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">Sign Up</h1>

      {isError && error && (
        <p className="mt-3 font-semibold text-center text-red-500">{error.message}</p>
      )}

      <form className="space-y-5" onSubmit={handleOnSubmit}>
        <Input
          label="First Name"
          id="firstName"
          name="firstName"
          type="text"
          value={firstName}
          required
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
          disabled={disableForm}
        />

        <Input
          label="Last Name"
          id="lastName"
          name="lastName"
          type="text"
          value={lastName}
          required
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
          disabled={disableForm}
        />

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

        <Button type="submit">Sign Up</Button>
      </form>
    </>
  )
}
