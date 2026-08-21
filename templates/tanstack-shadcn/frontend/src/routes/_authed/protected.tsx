import { createFileRoute } from '@tanstack/react-router';
import { Todos } from '@/components/Todos';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const Route = createFileRoute('/_authed/protected')({
  component: Protected,
});

function Protected() {
  const { user } = Route.useRouteContext();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>You are signed in</CardTitle>
          <CardDescription>
            The <code>_authed</code> layout route guards this page and redirects
            to <code>/signin</code> when there is no session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email: </span>
            {user.email ?? 'Not available'}
          </div>
          <div>
            <span className="text-muted-foreground">User ID: </span>
            {user.id ?? 'Not available'}
          </div>
        </CardContent>
      </Card>
      <Todos />
    </div>
  );
}
