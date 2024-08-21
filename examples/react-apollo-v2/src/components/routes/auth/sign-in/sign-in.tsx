import { Fingerprint, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import SignInFooter from '@/components/auth/sign-in-footer'
import OAuthLinks from '@/components/auth/oauth-links'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function SignIn() {
  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="mb-8 text-3xl">Sign In</h1>
        <OAuthLinks />

        <Separator className="my-4" />

        <div className="space-y-2">
          <Link
            to={'/sign-in/security-key'}
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
          >
            <Fingerprint className="w-4 h-4" />
            <span className="flex-1 text-center">Continue with a security key</span>
          </Link>

          <Link
            to={'/sign-in/magic-link'}
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
          >
            <Mail className="w-4 h-4" />
            <span className="flex-1 text-center">Continue with a magick link</span>
          </Link>

          <Link
            to={'/sign-in/email-password'}
            className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}
          >
            <span className="flex-1 text-center">Continue with email + password</span>
          </Link>
        </div>

        <Separator className="my-2" />

        <SignInFooter />
      </div>
    </div>
  )
}
