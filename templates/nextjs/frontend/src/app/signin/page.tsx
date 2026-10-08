import Link from 'next/link';
import { signInDestination } from '@/app/signin/destination';
import { type Intent, signInIntent } from '@/app/signin/intent';
import { methods } from '@/app/signin/methods';
import { signInQuery } from '@/app/signin/query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

// What the page says depends on why the visitor is here. Neither heading names
// a method, so both survive any selection.
const copy: Record<Intent, { title: string; description: string }> = {
  'sign-up': {
    title: 'Create an account',
    description: 'Choose how you want to sign up.',
  },
  'sign-in': {
    title: 'Sign in',
    description: 'Choose how you want to sign in.',
  },
};

/**
 * Lists the ways to sign in. Each method is a page of its own under
 * `/auth/<method>`; this page only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the visitor was going when a protected page sent them here,
 * and `intent` is whether they came to sign up or to sign in. Both are passed
 * along to whichever method they pick: one so that page can finish the trip,
 * the other so a form opens on the right mode.
 */
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    intent?: string | string[];
  }>;
}) {
  const { next, intent } = await searchParams;
  const destination = signInDestination(next);
  const chosen = signInIntent(intent);
  const query = signInQuery(destination, chosen);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{copy[chosen].title}</CardTitle>
          <CardDescription>{copy[chosen].description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {methods.map((method) => (
            <Link
              key={method.href}
              href={`${method.href}${query}`}
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
