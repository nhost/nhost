import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNhostClient } from '@nhost/react'
import { Link, useSearchParams } from 'react-router-dom'

export default function VerifyEmail() {
  const nhost = useNhostClient()
  const [searchParams] = useSearchParams()

  const ticket = searchParams.get('ticket')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('redirectTo')

  return (
    <div className="flex flex-row items-center justify-center w-screen min-h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center w-full max-w-md p-8 space-y-4 bg-white rounded-md shadow">
        <h1 className="text-3xl">Verify email</h1>
        <p className="px-20 text-center">Please verify your account by clicking the link below.</p>
        <Link
          to={`${nhost.auth.url}/verify?ticket=${ticket}&type=${type}&redirectTo=${redirectTo}`}
          className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
        >
          Verify
        </Link>
      </div>
    </div>
  )
}
