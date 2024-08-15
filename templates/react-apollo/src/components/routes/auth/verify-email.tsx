import { useNhostClient } from '@nhost/react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

export default function VerifyEmail() {
  const nhost = useNhostClient()
  const [searchParams] = useSearchParams()

  const redirectToVerificationLink = () => {
    const ticket = searchParams.get('ticket')
    const type = searchParams.get('type')
    const redirectTo = searchParams.get('redirectTo')

    if (ticket && type && redirectTo) {
      window.location.href = `${nhost.auth.url}/verify?ticket=${ticket}&type=${type}&redirectTo=${redirectTo}`
    } else {
      toast.error('An error occured while verifying your account')
    }
  }

  return <div></div>

  return (
    <div>
      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Stack align="center">
          <Text>Please verify your account by clicking the link below.</Text>
          <Button leftIcon={<FaEnvelope size={14} />} onClick={redirectToVerificationLink}>
            Verify
          </Button>
        </Stack>
      </Card>
    </div>
  )
}
