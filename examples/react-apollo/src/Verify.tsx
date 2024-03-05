import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useNhostClient } from '@nhost/react'
import { Container } from '@mantine/core'

const VerifyPage: React.FC = () => {
  const nhost = useNhostClient()
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const ticket = searchParams.get('ticket')
    const redirectTo = searchParams.get('redirectTo')
    const type = searchParams.get('type')

    if (ticket && redirectTo && type) {
      window.location.href = `${nhost.auth.url}/verify?ticket=${ticket}&type=${type}&redirectTo=${redirectTo}`
    }

    setLoading(false)
  }, [searchParams, nhost?.auth?.url])

  if (loading) {
    return null
  }

  return (
    <Container>
      <span>Failed to authenticate with magick link</span>
    </Container>
  )
}

export default VerifyPage
