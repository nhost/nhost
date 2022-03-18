import { Button, Input, Message } from 'rsuite'
import { useNavigate } from 'react-router-dom'
import { useSignInEmailPasswordless } from '@nhost/react'
import React, { useState, useEffect } from 'react'

export const EmailPasswordlessForm: React.FC = () => {
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const { signInEmailPasswordless, isError, isSuccess, error } = useSignInEmailPasswordless(email, {
    redirectTo: '/profile'
  })
  const [showError, setShowError] = useState(true)
  useEffect(() => {
    setShowError(false)
  }, [email])

  useEffect(() => {
    if (isSuccess) {
      navigate('/sign-in/verification-email-sent')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  return (
    <div>
      <Input
        placeholder="Email Address"
        value={email}
        onChange={setEmail}
        size="lg"
        autoFocus
        style={{ marginBottom: '0.5em' }}
      />
      {showError && isError && (
        <Message showIcon type="error">
          {error?.message}
        </Message>
      )}
      <Button
        block
        appearance="primary"
        style={{ marginTop: '0.5em' }}
        onClick={() => {
          setShowError(true)
          signInEmailPasswordless()
        }}
      >
        Continue with email
      </Button>
    </div>
  )
}
