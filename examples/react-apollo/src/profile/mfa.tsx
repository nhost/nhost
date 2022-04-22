import React from 'react'
import { useState } from 'react'
import { Button, Input, Panel } from 'rsuite'

import { useConfigMfa } from '@nhost/react'

export const Mfa: React.FC = () => {
  const [code, setCode] = useState('')
  const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } = useConfigMfa()

  return (
    <Panel header="Activate 2-step verification" bordered>
      {!isGenerated && (
        <Button block appearance="primary" onClick={generateQrCode}>
          Generate
        </Button>
      )}
      {isGenerated && !isActivated && (
        <div>
          <img alt="qrcode" src={qrCodeDataUrl} />
          <Input value={code} onChange={setCode} placeholder="Enter activation code" />
          <Button block appearance="primary" onClick={() => activateMfa(code)}>
            Activate
          </Button>
        </div>
      )}
      {isActivated && <div>MFA has been activated!!!</div>}
    </Panel>
  )
}
