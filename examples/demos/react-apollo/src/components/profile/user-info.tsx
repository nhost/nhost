import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Code from "@/components/ui/code";
import { useAuth } from "@/providers/auth";

export default function UserInfo() {
  const { user } = useAuth();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>User information</CardTitle>
      </CardHeader>
      <CardContent>
        <Code code={JSON.stringify(user, null, 2)} language="js" />
      </CardContent>
    </Card>
  );
}
