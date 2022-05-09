import React from 'react'
import { useState } from 'react'

import { useConfigMfa } from '@nhost/react'
import { Card, Button, TextInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'

export const Mfa: React.FC = () => {
  const [code, setCode] = useState('')
  const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } = useConfigMfa()
  const generate = async () => {
    const result = await generateQrCode()
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
      <Title>Activate 2-step verification</Title>
      {!isGenerated && (
        <Button fullWidth onClick={generate}>
          Generate
        </Button>
      )}
      {isGenerated && !isActivated && (
        <div>
          <img alt="qrcode" src={qrCodeDataUrl} />
          <TextInput
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter activation code"
          />
          <Button fullWidth onClick={() => activateMfa(code)}>
            Activate
          </Button>
        </div>
      )}
      {isActivated && <div>MFA has been activated!!!</div>}
    </Card>
  )
}
