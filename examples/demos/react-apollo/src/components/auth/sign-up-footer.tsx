import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { buttonVariants } from '../ui/button'

export default function SignUpFooter() {
  return (
    <p className="text-sm text-center">
      Already have an account{' '}
      <Link to="/sign-in" className={cn(buttonVariants({ variant: 'link' }), 'p-0')}>
        Sign in
      </Link>
    </p>
  )
}
