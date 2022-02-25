import { Button, Modal, Divider, Input, Message } from 'rsuite'
import { useEmailPasswordSignIn } from '@nhost/react'
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export const Password: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, isError, error } = useEmailPasswordSignIn(email, password)
  const [showError, setShowError] = useState(true)

  const [open, setOpen] = React.useState(false)
  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  useEffect(() => {
    setShowError(false)
  }, [email, password])

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

      {showError && isError && (
        <Message showIcon type="error">
          {error?.message}
        </Message>
      )}

      <Button
        appearance="primary"
        onClick={() => {
          setShowError(true)
          signIn()
        }}
        block
      >
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
