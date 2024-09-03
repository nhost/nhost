import { ChangeEmail } from '@/components/profile/change-email'
import ChangePassword from '@/components/profile/change-password'
import ConnectGithub from '@/components/profile/connect-github'
import JwtClaims from '@/components/profile/jwt-claims'
import Mfa from '@/components/profile/mfa'
import SecurityKeys from '@/components/profile/security-keys'
import UserInfo from '@/components/profile/user-info'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useUserIsAnonymous } from '@nhost/react'
import { Link } from 'react-router-dom'

export default function Profile() {
  const isAnonymous = useUserIsAnonymous()

  return (
    <div className="flex flex-col w-full gap-4">
      <Card className="w-full">
        <CardHeader className="p-4">
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {isAnonymous && (
              <>
                You signed in anonymously.{' '}
                <Link className={cn(buttonVariants({ variant: 'link' }), 'p-0')} to="/sign-up">
                  Sign up
                </Link>{' '}
                to complete your registration
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
      <ConnectGithub />
      <SecurityKeys />
      <Mfa />
      <ChangeEmail />
      <ChangePassword />
      <UserInfo />
      <JwtClaims />
    </div>
  )
}
