'use client'

import { useSignOut, useUserData } from '@nhost/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()
  const user = useUserData()
  const { signOut } = useSignOut()

  const navigation = [
    {
      href: '/',
      name: 'Home'
    },
    {
      href: '/protected',
      name: `${user ? '🔓' : '🔒'} Protected`
    }
  ]

  const handleSignOut = async () => {
    await signOut()
    router.replace('/sign-in')
  }

  return (
    <header className="bg-indigo-600">
      <nav className="container mx-auto">
        <div className="flex items-center justify-between w-full py-4">
          <div className="flex items-center">
            <div className="ml-10 space-x-8">
              {navigation.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-lg font-medium text-white hover:text-indigo-50"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="ml-10 space-x-4">
            {user ? (
              <button
                onClick={handleSignOut}
                className="inline-block px-4 py-2 text-base font-medium text-white bg-indigo-500 border border-transparent rounded-md hover:bg-opacity-75"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="inline-block px-4 py-2 text-base font-medium text-white bg-indigo-500 border border-transparent rounded-md hover:bg-opacity-75"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-block px-4 py-2 text-base font-medium text-indigo-600 bg-white border border-transparent rounded-md hover:bg-indigo-50"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
