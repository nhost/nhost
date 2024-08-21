import { useConfigMfa, useElevateSecurityKeyEmail, useUserEmail, useUserId } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { useState } from 'react'
import { toast } from 'sonner'
import { SECURITY_KEYS_LIST } from '../gql/security-keys'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'

export default function Mfa() {
  const userId = useUserId()
  const userEmail = useUserEmail()
  const [code, setCode] = useState('')
  const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } = useConfigMfa()

  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  useAuthQuery<{
    authUserSecurityKeys: {
      id: string
      nickname?: string
    }[]
  }>(SECURITY_KEYS_LIST, {
    variables: { userId },
    onCompleted: ({ authUserSecurityKeys }) => {
      setUserHasSecurityKey(authUserSecurityKeys?.length > 0)
    }
  })

  const generate = async () => {
    const result = await generateQrCode()
    if (result.error) {
      toast.error(result.error.message)
    }
  }

  const activate = async () => {
    if (!elevated && userHasSecurityKey) {
      try {
        const { elevated } = await elevateEmailSecurityKey(userEmail as string)

        if (!elevated) {
          throw new Error('Permissions were not elevated')
        }
      } catch {
        toast.error('Could not elevate permissions')
        return
      }
    }

    const { error, isError } = await activateMfa(code)

    if (isError) {
      toast.error(error?.message)
    } else {
      setCode('')
      toast.message('2-step verification activated')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <CardTitle>Activate 2-step verification</CardTitle>
          {!isGenerated && (
            <Button className="m-0" onClick={generate}>
              Generate
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isGenerated && !isActivated && (
            <div className="flex flex-col gap-2">
              <img alt="qrcode" src={qrCodeDataUrl} className="w-40" />
              <div className="flex flex-row gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter activation code"
                />
                <Button onClick={activate}>Activate</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
