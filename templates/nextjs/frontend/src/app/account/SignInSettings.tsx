import type { User } from '@nhost/nhost-js/auth';
import AccountSection from '@/app/account/AccountSection';
import ChangeEmailForm from '@/app/account/ChangeEmailForm';
import { methods } from '@/app/signin/methods';
import { ExpandableSetting, SettingsList } from '@/components/Setting';
import { localMailboxURL } from '@/lib/nhost/env';

/**
 * Every sign-in method, as the account page shows it.
 *
 * Reads the registry rather than importing a method: a method that has
 * settings of its own, like two-factor or the password itself, renders its
 * rows from its own directory, and `methods.ts` is the only shared file that
 * points at them. Deleting the method deletes its entry there, and this
 * section changes with it.
 *
 * A method with nothing to configure still gets named, so the page answers
 * "how else can I sign in?" rather than only listing what has a setting.
 *
 * The address leads, and is not in the registry: no single method owns it.
 * Magic link, the email code and the password all sign in with it, which is
 * why it belongs to the account rather than to any one of them.
 */

// "a", "a and b", "a, b and c".
function sentenceList(items: string[]): string {
  if (items.length < 2) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export default function SignInSettings({ user }: { user: User }) {
  const unmanaged = methods.filter((method) => !method.account);

  return (
    <AccountSection
      title="Sign-in settings"
      // The methods that configure nothing are the description. "The ways
      // this account can sign in" said less than naming them does.
      description={
        unmanaged.length > 0
          ? `${sentenceList(unmanaged.map((method) => method.title))} also ${unmanaged.length === 1 ? 'signs' : 'sign'} in to this account, with nothing to set up here.`
          : 'The ways this account can sign in.'
      }
    >
      <SettingsList>
        <ExpandableSetting
          label="Email"
          value={
            user.email ? (
              <>
                {user.email}
                {user.emailVerified ? null : (
                  <span className="text-destructive"> · not verified</span>
                )}
              </>
            ) : (
              'None'
            )
          }
          action="Change email"
        >
          <ChangeEmailForm
            email={user.email}
            verified={user.emailVerified}
            mailboxURL={localMailboxURL()}
          />
        </ExpandableSetting>
        {methods.flatMap((method) =>
          Object.entries(method.account ?? {}).map(([name, Setting]) => (
            <Setting key={`${method.href}#${name}`} user={user} />
          )),
        )}
      </SettingsList>
    </AccountSection>
  );
}
