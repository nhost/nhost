import Link from 'next/link';
import { signInDestination } from '@/app/signin/destination';
import { type Intent, signInIntent } from '@/app/signin/intent';
import { lastUsedSignIn } from '@/app/signin/lastUsed';
import { buttons, methods } from '@/app/signin/methods';
import { signInQuery } from '@/app/signin/query';
import LastUsedBadge from '@/components/LastUsedBadge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

// What the page says depends on why the visitor is here.
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

/** Lists the ways to sign in. */
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
  const { switchTo } = copy[chosen];
  const lastUsed = await lastUsedSignIn();

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        {/* Everything is centred, the links included, to match the provider
            buttons, which centre their own label. */}
        <CardHeader className="text-center">
          <CardTitle>{copy[chosen].title}</CardTitle>
          <CardDescription>{copy[chosen].description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-10">
          {methods.map((method) => (
            <Link
              key={method.href}
              href={`${method.href}${query}`}
              className="relative rounded-md border px-4 py-2 text-center outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {method.href === lastUsed ? <LastUsedBadge /> : null}
              <div className="font-medium text-sm">{method.title}</div>
              <div className="text-muted-foreground text-xs">
                {method.description}
              </div>
            </Link>
          ))}
          {buttons.length > 0 ? (
            <>
              {/* Set apart from the links: these leave for the provider
                  straight away, where a link opens a page of the app's. */}
              {methods.length > 0 ? (
                <div className="flex items-center gap-3 py-2 text-muted-foreground text-xs">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              {buttons.map((Buttons) => (
                <Buttons
                  key={Buttons.name}
                  destination={destination}
                  lastUsed={lastUsed}
                />
              ))}
            </>
          ) : null}
          {/* A clear gap, not a nudge: this is the way out of the list, not
              another item in it. */}
          <p className="pt-6 text-center text-muted-foreground text-sm">
            {switchTo.prompt}{' '}
            <Link
              href={`/signin${signInQuery(destination, switchTo.intent)}`}
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
