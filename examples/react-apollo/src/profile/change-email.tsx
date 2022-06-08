import { useState } from 'react'

import { Button, Card, Grid, TextInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useChangeEmail, useUserEmail } from '@nhost/react'

export const ChangeEmail: React.FC = () => {
  const [newEmail, setNewEmail] = useState('')
  const email = useUserEmail()
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
