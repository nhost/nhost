import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { nhost } from '@/lib/nhost/client';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const connectivity = useQuery({
    queryKey: ['connectivity'],
    queryFn: async () => {
      await nhost.graphql.request({ query: '{ __typename }' });
      return true;
    },
    retry: false,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Nhost + TanStack Start + shadcn/ui
        </h1>
        <p className="text-muted-foreground">
          A full-stack starter. The backend (auth, database and GraphQL API)
          lives in <code>backend/</code>; this app lives in{' '}
          <code>frontend/</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {connectivity.isPending
              ? 'Checking the Nhost GraphQL API…'
              : connectivity.data
                ? 'Connected to Nhost GraphQL ✓'
                : 'Backend not reachable'}
          </CardTitle>
          <CardDescription>
            {connectivity.isPending
              ? 'Contacting your GraphQL API.'
              : connectivity.data
                ? 'The frontend successfully reached your GraphQL API.'
                : 'Start the local backend with `cd backend && nhost up`, then reload this page.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Try authentication</CardTitle>
            <CardDescription>
              Sign in with an email one-time code. While running locally, the
              email with the code is captured by the local mail viewer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/protected">Protected page</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Try typed data</CardTitle>
            <CardDescription>
              The starter includes a per-user <code>todos</code> table with a
              typed query and mutation. Sign in, open the protected page, and
              add a todo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
