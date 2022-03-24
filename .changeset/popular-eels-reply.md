---
'@nhost/nextjs': minor
'@nhost/react': minor
---

Time-based One-Time Password Multi-Factor Authentication

**Note** MFA is not available out of the box yet in the [Nhost cloud](https://app.nhost.io/), but will be available in the near future.

When enabled in the backend, users that signed up with an email and a password can opt-in for an additional authentication security measure.
MFA can be activated in using the new `useConfigMfa` hook.

Two methods has been also added to `useEmailPasswordSignIn`: when MFA is active, authentication won't be a success straight after signin up with an email and a password.
The new `needsMfaOtp` will then appear as `true`, and the authentication will succeed only when the user will have sent back the OTP code with `sendMfaOtp(code:string)`.

```js
const { generateQrCode, isGenerating, isGenerated, qrCodeDataUrl, activateMfa, isActivating, isActivated, isError, error } =
  useConfigMfa(code?: string)
```

| Name             | Type                                                          | Notes                                                                                                           |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `generateQrCode` | () => void                                                    | Generates the QR code that will be used by the MFA app e.g. Google Authenticator or Authy.                      |
| `isGenerating`   | boolean                                                       | Returns `true` if the QR code is generating but not yet available                                               |
| `isGenerated`    | boolean                                                       | Returns `true` when the QR code has been successfully generated and is available                                |
| `qrCodeDataUrl`  | string                                                        | Returns the QR code as a [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) |
| `activateMfa`    | (code?: string) => void                                       | Activate MFA from the code given by the MFA authentication application                                          |
| `isActivating`   | boolean                                                       | Returns `true` when the activation code has been sent to the server, and we await server response               |
| `isActivated`    | boolean                                                       | Returns `true` when MFA has been successfully activated                                                         |
| `isError`        | boolean                                                       | Returns `true` if an error occurred.                                                                            |
| `error`          | {status: number, error: string, message: string} \| undefined | Provides details about the error.                                                                               |

#### Usage

```jsx
import { useConfigMfa } from '@nhost/react'
import { useState } from 'react'

export const Mfa: React.FC = () => {
  const [code, setCode] = useState('')
  const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } =
    useConfigMfa(code)

  return (
    <div>
      {!isGenerated && (
        <button block appearance="primary" onClick={generateQrCode}>
          Generate
        </button>
      )}
      {isGenerated && !isActivated && (
        <div>
          <img alt="qrcode" src={qrCodeDataUrl} />
          <input value={code} onChange={onChange={(event) => setCode(event.target.value)}} placeholder="Enter activation code" />
          <button block appearance="primary" onClick={activateMfa}>
            Activate
          </button>
        </div>
      )}
      {isActivated && <div>MFA has been activated!!!</div>}
    </div>
  )
}

```
