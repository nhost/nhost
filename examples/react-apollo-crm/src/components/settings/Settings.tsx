import { Main } from '../ui/Main'
import { ChangeEmail } from './ChangeEmail'
import { ChangePassword } from './ChangePassword'

export function Settings() {
  return (
    <Main>
      <div className="space-y-8">
        <ChangePassword />
        <ChangeEmail />
      </div>
    </Main>
  )
}
