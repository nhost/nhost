import { useHasuraClaims } from '@nhost/react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import Code from '../ui/code'

export default function JwtClaims() {
  const claims = useHasuraClaims()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Jwt Claims</CardTitle>
      </CardHeader>
      <CardContent>
        <Code code={JSON.stringify(claims, null, 2)} language="js" />
      </CardContent>
    </Card>
  )
}
