import { useState } from 'react'

import { gql } from '@apollo/client'
import { useChangeEmail, useElevateSecurityKeyEmail, useUserEmail, useUserId } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'

export const ChangeEmail: React.FC = () => {
  const userId = useUserId()
  const email = useUserEmail()
  const [newEmail, setNewEmail] = useState(email || '')
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  useAuthQuery<{
    authUserSecurityKeys: {
      id: string
      nickname?: string
    }[]
  }>(
    gql`
      query securityKeys($userId: uuid!) {
        authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
          id
          nickname
        }
      }
    `,
    {
      variables: { userId },
      onCompleted: ({ authUserSecurityKeys }) => {
        setUserHasSecurityKey(authUserSecurityKeys?.length > 0)
      }
    }
  )

  const { changeEmail } = useChangeEmail({
    redirectTo: '/profile'
  })

  const change = async () => {
    if (newEmail && email === newEmail) {
      toast.error('You need to set a different email as the current one')
      return
    }

    if (!elevated && userHasSecurityKey) {
      try {
        const { elevated } = await elevateEmailSecurityKey(email as string)

        if (!elevated) {
          throw new Error('Permissions were not elevated')
        }
      } catch {
        toast.error('Could not elevate permissions')

        return
      }
    }

    const result = await changeEmail(newEmail)

    if (result.needsEmailVerification) {
      toast.info(`Please check your inbox and follow the link to confirm the email change.`)
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
