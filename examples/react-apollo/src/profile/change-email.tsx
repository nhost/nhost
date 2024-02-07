import { useState } from 'react'

import { Button, Card, Grid, TextInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useChangeEmail, useElevateSecurityKeyEmail, useUserEmail, useUserId } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { SecurityKeysQuery } from 'src/generated'
import { SECURITY_KEYS_LIST } from 'src/utils'

export const ChangeEmail: React.FC = () => {
  const userId = useUserId()
  const email = useUserEmail()
  const [newEmail, setNewEmail] = useState('')
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  useAuthQuery<SecurityKeysQuery>(SECURITY_KEYS_LIST, {
    variables: { userId },
    onCompleted: ({ authUserSecurityKeys }) => {
      setUserHasSecurityKey(authUserSecurityKeys?.length > 0)
    }
  })

  const { changeEmail } = useChangeEmail({
    redirectTo: '/profile'
  })

  const change = async () => {
    if (newEmail && email === newEmail) {
      showNotification({
        title: 'Error',
        message: 'You need to set a different email as the current one'
      })
      return
    }

    if (!elevated && userHasSecurityKey) {
      try {
        const { elevated } = await elevateEmailSecurityKey(email as string)

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

    const result = await changeEmail(newEmail)

    if (result.needsEmailVerification) {
      showNotification({
        message: `An email has been sent to ${newEmail}. Please check your inbox and follow the link to confirm the email change.`
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
      <Title>Change email</Title>
      <Grid>
        <Grid.Col>
          <TextInput
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email"
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
