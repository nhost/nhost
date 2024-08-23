import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useChangePassword } from '@nhost/react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ChangePassword() {
  const [password, setPassword] = useState('')
  const { changePassword } = useChangePassword()

  const change = async () => {
    const result = await changePassword(password)

    if (result.isSuccess) {
      toast.success(`Password changed successfully.`)
    }
    if (result.error) {
      toast.error(result.error.message)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-2">
          <Input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
          <Button onClick={change}>Change</Button>
        </div>
      </CardContent>
    </Card>
  )
}
