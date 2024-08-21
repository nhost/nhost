import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Code from '@/components/ui/code'
import { useUserData } from '@nhost/react'

export default function UserInfo() {
  const userData = useUserData()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>User information</CardTitle>
      </CardHeader>
      <CardContent>
        <Code code={JSON.stringify(userData, null, 2)} language="js" />
      </CardContent>
    </Card>
  )
}
