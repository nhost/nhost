import { useSignInAnonymous } from '@nhost/react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

export default function SignInFooter() {
  const navigate = useNavigate()
  const { signInAnonymous } = useSignInAnonymous()

  const anonymousHandler = async () => {
    const { isSuccess } = await signInAnonymous()
    if (isSuccess) {
      navigate('/')
    }
  }

  return (
    <p className="text-sm text-center">
      Don&lsquo;t have an account?{' '}
      <Link to="/sign-up" className={cn(buttonVariants({ variant: 'link' }), 'm-0, p-0')}>
        Sign up
      </Link>{' '}
      or{' '}
      <Button variant="link" className="p-0 m-0" onClick={anonymousHandler}>
        sign in anonymously
      </Button>
    </p>
  )
}
