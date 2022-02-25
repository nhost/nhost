import { useAuthenticated } from '@nhost/react'
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const VerificationEmailSent: React.FC = () => {
  const isAuthenticated = useAuthenticated()
  const navigate = useNavigate()
  useEffect(() => {
    if (isAuthenticated) navigate('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])
  return (
    <div>
      A verification email has been sent. Please check your inbox and follow the link to complete
      authentication.
    </div>
  )
}
