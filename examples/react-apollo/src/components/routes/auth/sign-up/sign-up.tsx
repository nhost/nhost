import OAuthLinks from '@/components/auth/oauth-links'
import SignUpFooter from '@/components/auth/sign-up-footer'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Fingerprint, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SignUp() {
  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-3xl">Sign Up</h1>
        <OAuthLinks />

        <Separator className="my-4" />

        <div className="space-y-2">
          <Link
            to="/sign-up/security-key"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full text-center')}
          >
            <Fingerprint className="w-4 h-4" />
            <span className="flex-1">Continue with a security key</span>
          </Link>
          <Link
            to="/sign-up/magic-link"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full text-center')}
          >
            <Mail className="w-4 h-4" />
            <span className="flex-1">Continue with a magic link</span>
          </Link>
          <Link
            to={'/sign-up/email-password'}
            className={cn(buttonVariants({ variant: 'ghost' }), 'w-full text-center')}
          >
            <span className="flex-1">Continue with email + password</span>
          </Link>
        </div>

        <Separator className="my-2" />

        <SignUpFooter />
      </div>
    </div>
  )
}
