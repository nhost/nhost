import JwtClaims from '@/components/profile/jwt-claims'
import UserInfo from '@/components/profile/user-info'

export default function Profile() {
  return (
    <div className="flex flex-col w-full gap-4">
      <UserInfo />
      <JwtClaims />
    </div>
  )
}
