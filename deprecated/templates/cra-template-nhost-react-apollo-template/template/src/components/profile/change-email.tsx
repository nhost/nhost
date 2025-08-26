import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useChangeEmail, useUserEmail } from '@nhost/react'
import { toast } from 'sonner'
import { Input } from '../ui/input'

export default function ChangeEmail() {
  const email = useUserEmail()
  const [newEmail, setNewEmail] = useState(email || '')

  const { changeEmail } = useChangeEmail({
    redirectTo: '/profile'
  })

  const change = async () => {
    if (newEmail && email === newEmail) {
      toast.error('You need to set a different email as the current one')
      return
    }

    const result = await changeEmail(newEmail)

    if (result.needsEmailVerification) {
      toast.info(
        `An email has been sent to ${newEmail}. Please check your inbox and follow the link to confirm the email change.`
      )
    }
    if (result.error) {
      toast.error(result.error.message)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Change email</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email"
          />
          <Button onClick={change}>Change</Button>
        </div>
      </CardContent>
    </Card>
  )
}
