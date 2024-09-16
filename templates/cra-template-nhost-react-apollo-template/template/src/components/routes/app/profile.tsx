import ChangeEmail from '@/components/profile/change-email'
import ChangePassword from '@/components/profile/change-password'
import JwtClaims from '@/components/profile/jwt-claims'
import UserInfo from '@/components/profile/user-info'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export default function Profile() {
  return (
    <div className="flex flex-col w-full gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
      </Card>
      <ChangeEmail />
      <ChangePassword />
      <UserInfo />
      <JwtClaims />
    </div>
  )
}
