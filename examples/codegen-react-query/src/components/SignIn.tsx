import React, { useState } from 'react'

import { useSignInEmailPasswordless } from '@nhost/react'

export function SignIn() {
  const [email, setEmail] = useState('')

  const { signInEmailPasswordless, error } = useSignInEmailPasswordless()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { error } = await signInEmailPasswordless(email)

    if (error) {
      alert('Error signing in')
      console.log(error)
      return
    }
    alert('Magic Link Sent')
    window.open('https://local.mailhog.nhost.run/', '_blank')
  }

  return (
    <div className="my-4 max-w-xs mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-500">
            Email
          </label>
          <div className="mt-1">
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              id="email"
              className="bg-gray-800 border-gray-600 text-gray-100 block w-full rounded-sm shadow-sm focus:shadow-md sm:text-sm"
            />
          </div>
        </div>
        <div>
          <button
            type="submit"
            className="rounded-sm border border-transparent px-3 py-2 text-sm font-medium leading-4 bg-slate-100 hover:bg-slate-200 text-gray-800 shadow-sm hover:focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full "
          >
            Send Magic Link
          </button>
        </div>
        {error && <div>{error.message}</div>}
      </form>
    </div>
  )
}
