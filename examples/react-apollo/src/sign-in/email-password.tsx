import { Button, Modal, Divider, Input, Message } from 'rsuite'
import { useEmailPasswordSignIn } from '@nhost/react'
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export const Password: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, error } = useEmailPasswordSignIn(email, password)

  const [errorMessage, setErrorMessage] = useState('')
  // * Set error message from the authentication hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email or password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [email, password])

  // * State of the reset password modal
  const [open, setOpen] = React.useState(false)
  const handleOpen = () => email && setOpen(true)
  const handleClose = () => setOpen(false)

  return (
    <div>
      <Input
        value={email}
        onChange={setEmail}
        placeholder="Email Address"
        size="lg"
        autoFocus
        style={{ marginBottom: '0.5em' }}
      />
      <Input
        value={password}
        onChange={setPassword}
        placeholder="Password"
        type="password"
        size="lg"
        style={{ marginBottom: '0.5em' }}
      />

      {errorMessage && (
        <Message showIcon type="error">
          {errorMessage}
        </Message>
      )}

      <Button appearance="primary" onClick={signIn} block>
        Sign in
      </Button>
      <Button onClick={handleOpen} block>
        Forgot password?
      </Button>
      <Divider />
      <Button as={NavLink} to="/sign-in" block appearance="link">
        &#8592; Other Login Options
      </Button>

      <Modal open={!!email && open} onClose={handleClose}>
        <Modal.Header>
          <Modal.Title>Reset password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Do you want us to send you an email to {email} with a link to reset your password?
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleClose} appearance="primary">
            Yes
          </Button>
          <Button onClick={handleClose} appearance="subtle">
            No
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
