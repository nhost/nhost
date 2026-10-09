import { Link, useSearchParams } from 'react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signInDestination } from '@/signin/destination';
import { type Intent, signInIntent } from '@/signin/intent';
import { methods } from '@/signin/methods';
import { signInQuery } from '@/signin/query';

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

// What the page says depends on why the visitor is here. Neither heading names
// a method, so both survive any selection. Each also offers the other intent,
// since a protected page sends a visitor here without one and the page then
// opens on sign up, whether or not they have an account.
const copy: Record<
  Intent,
  {
    title: string;
    description: string;
    switchTo: { intent: Intent; prompt: string; label: string };
  }
> = {
  'sign-up': {
    title: 'Create an account',
    description: 'Choose how you want to sign up.',
    switchTo: {
      intent: 'sign-in',
      prompt: 'Already have an account?',
      label: 'Sign in',
    },
  },
  'sign-in': {
    title: 'Sign in',
    description: 'Choose how you want to sign in.',
    switchTo: {
      intent: 'sign-up',
      prompt: 'New here?',
      label: 'Create an account',
    },
  },
};

export default function SignInPage() {
  const [params] = useSearchParams();
  const destination = signInDestination(params.get('next') ?? undefined);
  const intent = signInIntent(params.get('intent') ?? undefined);
  const query = signInQuery(destination, intent);
  const { switchTo } = copy[intent];

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{copy[intent].title}</CardTitle>
          <CardDescription>{copy[intent].description}</CardDescription>
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
          <p className="pt-2 text-muted-foreground text-sm">
            {switchTo.prompt}{' '}
            <Link
              to={`/signin${signInQuery(destination, switchTo.intent)}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {switchTo.label}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
