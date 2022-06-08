import { useState } from 'react'

import { Button, Card, Grid, PasswordInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useChangePassword } from '@nhost/react'

export const ChangePassword: React.FC = () => {
  const [password, setPassword] = useState('')
  const { changePassword } = useChangePassword()

  const change = async () => {
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
