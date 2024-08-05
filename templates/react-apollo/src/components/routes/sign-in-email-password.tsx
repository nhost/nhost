import { SiApple, SiGithub, SiGoogle, SiLinkedin } from '@icons-pack/react-simple-icons'
import { Fingerprint, Mail } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'

export default function SignInEmailPassword() {
  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 bg-white rounded-md">
        <h1 className="mb-8 text-4xl">Sign in using email and password</h1>
        <div className="flex flex-col w-full max-w-md space-y-2">
          <form>
            <Button></Button>
          </form>
        </div>

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
          <Button variant="ghost" className="w-full">
            <span className="flex-1">Continue with a email password</span>
          </Button>
        </div>

        <Separator className="my-4" />

        <p className="text-center">
          Don&lsquo;t have an account?{' '}
          <a href="/sign-up" className="hover:underline hover:cursor-pointer">
            Sign up
          </a>{' '}
          or{' '}
          <a className="hover:underline hover:cursor-pointer" onClick={anonymousHandler}>
            sign in anonymously
          </a>
        </p>
      </div>
    </div>
  )
}
