import { useConfigMfa } from '@nhost/react'
import { useState } from 'react'
import { Button, Input, Panel } from 'rsuite'

export const Mfa: React.FC = () => {
  const [code, setCode] = useState('')
  const { generate, activate, isActivated, isGenerated, qrCode } = useConfigMfa(code)

  return (
    <Panel header="Activate 2-step verification" bordered>
      {!isGenerated && (
        <Button block appearance="primary" onClick={generate}>
          Generate
        </Button>
      )}
      {isGenerated && !isActivated && (
        <div>
          <img alt="qrcode" src={qrCode} />
          <Input value={code} onChange={setCode} placeholder="Enter activation code" />
          <Button block appearance="primary" onClick={activate}>
            Activate
          </Button>
        </div>
      )}
      {isActivated && <div>MFA has been activated!!!</div>}
    </Panel>
  )
}
