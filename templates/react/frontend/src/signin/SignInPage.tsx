import { Link, useSearchParams } from 'react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DEFAULT_DESTINATION, signInDestination } from '@/signin/destination';
import { methods } from '@/signin/methods';

/**
 * Lists the ways to sign in. Each method is a page of its own under
 * `/auth/<method>`; this page only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the visitor was going when a protected page sent them here.
 * It is passed along to whichever method they pick, so that page can finish
 * the trip after signing them in.
 */
export default function SignInPage() {
  const [params] = useSearchParams();
  const destination = signInDestination(params.get('next') ?? undefined);
  const query =
    destination === DEFAULT_DESTINATION
      ? ''
      : `?next=${encodeURIComponent(destination)}`;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Choose how you want to sign in.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {methods.map((method) => (
            <Link
              key={method.href}
              to={`${method.href}${query}`}
              className="rounded-md border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="font-medium">{method.title}</div>
              <div className="text-muted-foreground text-sm">
                {method.description}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
