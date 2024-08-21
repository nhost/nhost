import { ChangeEmail } from '../../profile/change-email'
import ChangePassword from '../../profile/change-password'
import JwtClaims from '../../profile/jwt-claims'
import Mfa from '../../profile/mfa'
import SecurityKeys from '../../profile/security-keys'
import UserInfo from '../../profile/user-info'

export default function Profile() {
  return (
    <div className="flex flex-col w-full gap-4">
      <SecurityKeys />
      <Mfa />
      <ChangeEmail />
      <ChangePassword />
      <UserInfo />
      <JwtClaims />
    </div>
  )
}
