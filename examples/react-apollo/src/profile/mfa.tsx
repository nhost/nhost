import { useState } from 'react'

import { Button, Card, TextInput, Title } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useConfigMfa, useElevateSecurityKeyEmail, useUserEmail, useUserId } from '@nhost/react'
import { SECURITY_KEYS_LIST } from 'src/utils'
import { SecurityKeysQuery } from 'src/generated'
import { useAuthQuery } from '@nhost/react-apollo'

export const Mfa: React.FC = () => {
  const userId = useUserId()
  const userEmail = useUserEmail()
  const [code, setCode] = useState('')
  const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } = useConfigMfa()

  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  useAuthQuery<SecurityKeysQuery>(SECURITY_KEYS_LIST, {
    variables: { userId },
    onCompleted: ({ authUserSecurityKeys }) => {
      setUserHasSecurityKey(authUserSecurityKeys?.length > 0)
    }
  })

  const activate = async () => {
    if (!elevated && userHasSecurityKey) {
      try {
        const { elevated } = await elevateEmailSecurityKey(userEmail as string)

        if (!elevated) {
          throw new Error('Permissions were not elevated')
        }
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Could not elevate permissions'
        })

        return
      }
    }

    const { error, isError } = await activateMfa(code)

    if (isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: error?.message
      })
    }
  }

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
          <Button fullWidth onClick={activate}>
            Activate
          </Button>
        </div>
      )}
      {isActivated && <div>MFA has been activated!!!</div>}
    </Card>
  )
}
