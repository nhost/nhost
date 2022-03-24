import { useConfigMfa } from '@nhost/react'
import { useState } from 'react'
import { Button, Input, Panel } from 'rsuite'

export const Mfa: React.FC = () => {
  const [code, setCode] = useState('')
  const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } =
    useConfigMfa(code)

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
          <Button block appearance="primary" onClick={activateMfa}>
            Activate
          </Button>
        </div>
      )}
      {isActivated && <div>MFA has been activated!!!</div>}
    </Panel>
  )
}
