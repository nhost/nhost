import { Button, Card, Container, Stack, Text } from '@mantine/core'
import { useNhostClient } from '@nhost/react'
import { FaEnvelope } from 'react-icons/fa'
import { useSearchParams } from 'react-router-dom'

const VerifyPage: React.FC = () => {
  const nhost = useNhostClient()
  const [searchParams] = useSearchParams()

  const redirectToVerificationLink = () => {
    const ticket = searchParams.get('ticket')
    const redirectTo = searchParams.get('redirectTo')
    const type = searchParams.get('type')

    window.location.href = `${nhost.auth.url}/verify?ticket=${ticket}&type=${type}&redirectTo=${redirectTo}`
  }

  return (
    <Container>
      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Stack align="center">
          <Text>Please verify your account by clicking the link below.</Text>
          <Button leftIcon={<FaEnvelope size={14} />} onClick={redirectToVerificationLink}>
            Verify
          </Button>
        </Stack>
      </Card>
    </Container>
  )
}

export default VerifyPage
