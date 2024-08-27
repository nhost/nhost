import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { gql } from '@apollo/client'
import {
  useChangePassword,
  useElevateSecurityKeyEmail,
  useUserEmail,
  useUserId
} from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function ChangePassword() {
  const userEmail = useUserEmail()
  const userId = useUserId()
  const [password, setPassword] = useState('')
  const { changePassword } = useChangePassword()
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  const { data } = useAuthQuery<{
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
    { variables: { userId } }
  )

  useEffect(() => {
    const authUserSecurityKeys = data?.authUserSecurityKeys

    if (authUserSecurityKeys) {
      setUserHasSecurityKey(authUserSecurityKeys.length > 0)
    }
  }, [data])

  const change = async () => {
    if (!elevated && userHasSecurityKey) {
      try {
        const { elevated } = await elevateEmailSecurityKey(userEmail as string)

        if (!elevated) {
          throw new Error('Permissions were not elevated')
        }
      } catch {
        toast.error('Could not elevate permissions')

        return
      }
    }

    const result = await changePassword(password)

    if (result.isSuccess) {
      toast.success(`Password changed successfully.`)
    }
    if (result.error) {
      toast.error(result.error.message)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-2">
          <Input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
          <Button onClick={change}>Change</Button>
        </div>
      </CardContent>
    </Card>
  )
}
