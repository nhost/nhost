/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useState } from 'react'
import { Button, FlexboxGrid, Input, Message, Notification, Panel, toaster } from 'rsuite'

import { useChangeEmail, useEmail } from '@nhost/react'

export const ChangeEmail: React.FC = () => {
  const [newEmail, setNewEmail] = useState('')
  const email = useEmail()
  const { changeEmail, error, needsEmailVerification } = useChangeEmail({
    redirectTo: '/profile'
  })
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (needsEmailVerification) {
      toaster.push(
        <Notification type="info" header="Info" closable>
          An email has been sent to {newEmail}. Please check your inbox and follow the link to
          confirm the email change.
        </Notification>
      )
      setNewEmail('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsEmailVerification])

  // * Set error message from the registration hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email input changed
  useEffect(() => {
    setErrorMessage('')
  }, [newEmail])
  // * Show an error message when passwords are different
  useEffect(() => {
    if (newEmail && email === newEmail)
      setErrorMessage('You need to set a different email as the current one')
    else setErrorMessage('')
  }, [email, newEmail])

  return (
    <Panel header="Change email" bordered>
      <FlexboxGrid>
        <FlexboxGrid.Item colspan={12}>
          <Input value={newEmail} onChange={setNewEmail} placeholder="New email" />
        </FlexboxGrid.Item>
        <FlexboxGrid.Item colspan={12}>
          <Button onClick={() => changeEmail(email)} block appearance="primary">
            Change
          </Button>
        </FlexboxGrid.Item>
      </FlexboxGrid>

      {errorMessage && (
        <Message showIcon type="error">
          {errorMessage}
        </Message>
      )}
    </Panel>
  )
}
