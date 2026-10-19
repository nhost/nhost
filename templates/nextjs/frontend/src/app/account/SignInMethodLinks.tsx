import Link from 'next/link';
import AccountSection from '@/app/account/AccountSection';
import { methods } from '@/app/signin/methods';

/**
 * The account-page entries sign-in methods declare in `methods.ts`.
 *
 * Reads the registry rather than importing a method: a method that has
 * settings of its own, like two-factor for the password method, lives in its
 * own directory, and this is the only way shared code points at it. Deleting
 * the method deletes its line in the registry, and this section changes with
 * it.
 */
export default function SignInMethodLinks() {
  const entries = methods.flatMap((method) =>
    method.account ? [method.account] : [],
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <AccountSection
      title="Sign-in settings"
      description="Options that belong to a sign-in method."
    >
      {/* Two to a row: each entry is a title and a line, so a column of them
          left the section mostly empty space. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-md border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="font-medium">{entry.title}</div>
            <div className="text-muted-foreground text-sm">
              {entry.description}
            </div>
          </Link>
        ))}
      </div>
    </AccountSection>
  );
}
