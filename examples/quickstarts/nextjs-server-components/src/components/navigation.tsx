import { signOut } from '@server-actions/auth'
import Link from 'next/link'
import { getNhost } from '../utils/nhost'
import SignOut from './sign-out'

export default async function Navigation() {
  const nhost = await getNhost()
  const user = nhost.auth.getUser()

  const nav = [
    {
      href: '/',
      name: 'Home'
    },
    {
      href: '/protected/todos',
      name: `${user ? '🔓' : '🔒'} Todos`
    },
    {
      href: '/protected/echo',
      name: `${user ? '🔓' : '🔒'} Echo`
    },
    {
      href: '/protected/pat',
      name: `${user ? '🔓' : '🔒'} PAT`
    }
  ]

  return (
    <header className="bg-indigo-600">
      <nav className="container mx-auto">
        <div className="flex items-center justify-between w-full py-4">
          <div className="flex items-center">
            <div className="ml-10 space-x-8">
              {nav.map((link) => (
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
              <SignOut signOut={signOut} />
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className="inline-block px-4 py-2 text-base font-medium text-white bg-indigo-500 border border-transparent rounded-md hover:bg-opacity-75"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
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
