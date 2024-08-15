import { useSignInAnonymous } from '@nhost/react'
import { Fingerprint, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import OAuthLinks from '../../oauth-links'
import { Button } from '../../ui/button'
import { Separator } from '../../ui/separator'

export default function SignIn() {
  const navigate = useNavigate()
  const { signInAnonymous } = useSignInAnonymous()

  const anonymousHandler = async () => {
    const { isSuccess } = await signInAnonymous()
    if (isSuccess) {
      navigate('/')
    }
  }

  const goToSignInEmailPassword = () => navigate('/sign-in/email-password')

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md shadow">
        <h1 className="mb-8 text-4xl">Sign In</h1>
        <OAuthLinks />

        <Separator className="my-4" />

        <div className="space-y-2">
          <Button variant="outline" className="w-full">
            <Fingerprint className="w-4 h-4" />
            <span className="flex-1">Continue with a security key</span>
          </Button>
          <Button variant="outline" className="w-full">
            <Mail className="w-4 h-4" />
            <span className="flex-1">Continue with a magick link</span>
          </Button>
          <Button variant="ghost" className="w-full" onClick={goToSignInEmailPassword}>
            <span className="flex-1">Continue with email + password</span>
          </Button>
        </div>

        <Separator className="my-4" />

        <p className="text-center">
          Don&lsquo;t have an account?{' '}
          <Link to="/sign-up" className="hover:underline hover:cursor-pointer">
            Sign up
          </Link>{' '}
          or{' '}
          <a className="hover:underline hover:cursor-pointer" onClick={anonymousHandler}>
            sign in anonymously
          </a>
        </p>
      </div>
    </div>
  )
}
