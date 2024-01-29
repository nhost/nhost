import { useState } from 'react'

import { Button, Card, Grid, TextInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import {
  useChangeEmail,
  useUserEmail,
  useElevateSecurityKeyEmail,
  useHasElevatedPermissions
} from '@nhost/react'

export const ChangeEmail: React.FC = () => {
  const [newEmail, setNewEmail] = useState('')

  const email = useUserEmail()

  const { changeEmail } = useChangeEmail({
    redirectTo: '/profile'
  })

  const { elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const elevated = useHasElevatedPermissions()

  const change = async () => {
    if (newEmail && email === newEmail) {
      showNotification({
        title: 'Error',
        message: 'You need to set a different email as the current one'
      })
      return
    }

    if (!elevated) {
      try {
        const res = await elevateEmailSecurityKey(email as string)

        if (!res.elevated) {
          showNotification({
            color: 'red',
            title: 'Error',
            message: 'Failed to elevate permissions!'
          })

          return
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
      } catch (error) {
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'An error has occured while trying to change the email! Please try again later.'
        })
      }
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
