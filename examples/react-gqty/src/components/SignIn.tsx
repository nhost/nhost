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
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <input type="email" placeholder="email" onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <button type="submit">Sign In</button>
        </div>
        {error && <div>{error.message}</div>}
      </form>
    </div>
  )
}
