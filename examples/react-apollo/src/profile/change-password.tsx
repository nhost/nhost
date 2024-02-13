import { useEffect, useState } from 'react'

import { Button, Card, Grid, PasswordInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import {
  useChangePassword,
  useElevateSecurityKeyEmail,
  useUserEmail,
  useUserId
} from '@nhost/react'
import { SecurityKeysQuery } from 'src/generated'
import { SECURITY_KEYS_LIST } from 'src/utils'
import { useAuthQuery } from '@nhost/react-apollo'

export const ChangePassword: React.FC = () => {
  const userEmail = useUserEmail()
  const userId = useUserId()
  const [password, setPassword] = useState('')
  const { changePassword } = useChangePassword()
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  const { data } = useAuthQuery<SecurityKeysQuery>(SECURITY_KEYS_LIST, { variables: { userId } })

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
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Could not elevate permissions'
        })

        return
      }
    }

    const result = await changePassword(password)
    if (result.isSuccess) {
      showNotification({
        message: `Password changed successfully.`
      })
    }
    if (result.error) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error.message
      })
    }
  }
  return (
    <Card shadow="sm" p="lg" m="sm">
      <Title>Change password</Title>
      <Grid>
        <Grid.Col>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
        </Grid.Col>
        <Grid.Col>
          <Button onClick={change} fullWidth>
            Change
          </Button>
        </Grid.Col>
      </Grid>
    </Card>
  )
}
