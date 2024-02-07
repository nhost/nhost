import { useSignInEmailPassword } from '@nhost/nextjs'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function SignIn() {
  const router = useRouter()

  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')

  const { signInEmailPassword } = useSignInEmailPassword()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log({
      email,
      password
    })

    const res = await signInEmailPassword(email, password)

    if (!res.isError) router.push('/todos')
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <form onSubmit={handleSubmit} className="flex flex-col max-w-xl space-y-4">
        <input value={email} placeholder="email" onChange={(e) => setEmail(e.target.value)} />
        <input
          value={password}
          placeholder="password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Sign In</button>
      </form>
    </div>
  )
}
