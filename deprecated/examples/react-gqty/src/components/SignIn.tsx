import React, { useState } from 'react'

import { useSignInEmailPasswordless } from '@nhost/react'

export function SignIn() {
  const [email, setEmail] = useState('')

  const { signInEmailPasswordless, error } = useSignInEmailPasswordless()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await signInEmailPasswordless(email)
    alert('Magic Link Sent')
  }

  return (
    <div className="my-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="mt-1">
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              id="email"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        <div>
          <button
            type="submit"
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Sign In with a magic link
          </button>
        </div>
        {error && <div>{error.message}</div>}
      </form>
    </div>
  )
}
