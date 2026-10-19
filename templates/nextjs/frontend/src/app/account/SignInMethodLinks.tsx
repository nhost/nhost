import Link from 'next/link';
import AccountSection from '@/app/account/AccountSection';
import { methods } from '@/app/signin/methods';

/**
 * Every sign-in method, as the account page shows it.
 *
 * Reads the registry rather than importing a method: a method that has
 * settings of its own, like two-factor or the password itself, lives in its
 * own directory, and this is the only way shared code points at it. Deleting
 * the method deletes its line in the registry, and this section changes with
 * it.
 *
 * A method with nothing to configure still gets named, so the page answers
 * "how else can I sign in?" rather than only listing what has a page.
 */

// "a", "a and b", "a, b and c".
function sentenceList(items: string[]): string {
  if (items.length < 2) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export default function SignInMethodLinks() {
  const entries = methods.flatMap((method) => method.account ?? []);
  const unmanaged = methods.filter((method) => !method.account);

  if (entries.length === 0 && unmanaged.length === 0) {
    return null;
  }

  return (
    <AccountSection
      title="Sign-in settings"
      // The methods that configure nothing are the description. "The ways
      // this account can sign in" said less than naming them does, and as a
      // line under the links they were easy to read as a footnote.
      description={
        unmanaged.length > 0
          ? `${sentenceList(unmanaged.map((method) => method.title))} also sign in to this account, with nothing to set up here.`
          : 'The ways this account can sign in.'
      }
    >
      {entries.length > 0 ? (
        // Two to a row: each entry is a title and a line, so a column of them
        // left the section mostly empty space.
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
      ) : null}
    </AccountSection>
  );
}
