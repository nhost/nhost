import { Main } from '../ui/Main'
import { ChangeEmail } from './ChangeEmail'
import { ChangePassword } from './ChangePassword'

export function Settings() {
  return (
    <Main>
      <div className="space-y-8">
        <div className="max-w-4xl border border-gray-200 rounded p-6">
          <ChangePassword />
        </div>
        <div className="max-w-4xl border border-gray-200 rounded p-6">
          <ChangeEmail />
        </div>
      </div>
    </Main>
  )
}
