import ConnectGithub from '@/components/profile/connect-github'
import { ChangeEmail } from '@/components/profile/change-email'
import ChangePassword from '@/components/profile/change-password'
import JwtClaims from '@/components/profile/jwt-claims'
import Mfa from '@/components/profile/mfa'
import SecurityKeys from '@/components/profile/security-keys'
import UserInfo from '@/components/profile/user-info'

export default function Profile() {
  return (
    <div className="flex flex-col w-full gap-4">
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
