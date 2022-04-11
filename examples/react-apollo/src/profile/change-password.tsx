import React from 'react'
import { useEffect, useState } from 'react'
import { Button, FlexboxGrid, Input, Message, Notification, Panel, toaster } from 'rsuite'

import { useChangePassword } from '@nhost/react'

export const ChangePassword: React.FC = () => {
  const [password, setPassword] = useState('')
  const { changePassword, isSuccess, error } = useChangePassword()
  const [errorMessage, setErrorMessage] = useState('')

  // * See https://github.com/rsuite/rsuite/issues/2336
  useEffect(() => {
    toaster.push(<div />)
  }, [])
  useEffect(() => {
    if (isSuccess) {
      setPassword('')
      toaster.push(
        <Notification type="info" header="Info" closable>
          Password changed successfully.
        </Notification>
      )
      setPassword('')
    }
  }, [isSuccess])

  // * Set error message from the registration hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [password])

  return (
    <Panel header="Change password" bordered>
      <FlexboxGrid>
        <FlexboxGrid.Item colspan={12}>
          <Input
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="New password"
          />
        </FlexboxGrid.Item>
        <FlexboxGrid.Item colspan={12}>
          <Button onClick={() => changePassword(password)} block appearance="primary">
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
