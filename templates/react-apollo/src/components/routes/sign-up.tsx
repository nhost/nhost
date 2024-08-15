import { cn } from '@/lib/utils'
import { Fingerprint, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import OAuthLinks from '../../../../../examples/react-apollo-v2/src/components/oauth-links'
import { buttonVariants } from '../ui/button'
import { Separator } from '../ui/separator'

export default function SignUp() {
  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-4xl">Sign Up</h1>
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
            to="/sign-up/magick-link"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full text-center')}
          >
            <Mail className="w-4 h-4" />
            <span className="flex-1">Continue with a magick link</span>
          </Link>
          <Link
            to={'/sign-up/email-password'}
            className={cn(buttonVariants({ variant: 'ghost' }), 'w-full text-center')}
          >
            <span className="flex-1">Continue with email + password</span>
          </Link>
        </div>

        <Separator className="my-4" />

        <p className="text-center">
          Already have an account
          <Link to="/sign-in" className={cn(buttonVariants({ variant: 'link' }), 'px-2')}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
