import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card'

export default function SecurityKeys() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Security keys</CardTitle>
        <CardDescription>
          You are authenticated. You have now access to the authorised part of the application.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
