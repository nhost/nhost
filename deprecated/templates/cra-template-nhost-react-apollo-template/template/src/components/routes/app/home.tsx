import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Home page</CardTitle>
        <CardDescription>
          You are authenticated. You have now access to the authorised part of the application.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
