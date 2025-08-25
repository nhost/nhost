'use client'

import Input from '@components/input'
import SubmitButton from '@components/submit-button'
import { NhostClient } from '@nhost/nhost-js'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

const NHOST_SESSION_KEY = 'nhostSession'

const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
  region: process.env.NEXT_PUBLIC_NHOST_REGION
})

export default function SignUpWebAuthn() {
  const router = useRouter()

  const [error, setError] = useState('')
  const [email, setEmail] = useState('')

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()

    const { session, error } = await nhost.auth.signUp({
      email,
      securityKey: true
    })

    if (error) {
      setError(error.message)
    }

    console.log({
      handleSignUpSession: session
    })

    if (session) {
      Cookies.set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
      router.push('/protected/todos')
    }
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-center">Sign Up with a security key</h1>

      {error && <p className="mt-3 font-semibold text-center text-red-500">{error}</p>}

      <form className="w-full max-w-lg space-y-5" onSubmit={handleSignUp}>
        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />
        <SubmitButton type="submit" className="w-full">
          Sign Up
        </SubmitButton>
      </form>
    </div>
  )
}
