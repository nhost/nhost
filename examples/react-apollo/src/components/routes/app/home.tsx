import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Home page</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-500">
        <p>You are authenticated. You have now access to the authorised part of the application.</p>
      </CardContent>
    </Card>
  )
}
