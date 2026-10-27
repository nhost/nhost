import type { User } from '@nhost/nhost-js/auth';
import ChangeEmailForm from '@/app/account/ChangeEmailForm';
import { buttonSettings, methods } from '@/app/signin/methods';
import { DialogSetting, SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';

/** Every sign-in method, as the account page shows it. */

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
    <Card className="gap-0 py-0">
      <h2 className="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
        Sign-in
      </h2>
      <SettingsList>
        <DialogSetting
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
          action="Change"
          title="Change email"
          description="We'll send a link to the new address to confirm it."
        >
          <ChangeEmailForm
            email={user.email}
            verified={user.emailVerified}
            mailboxURL={localMailboxURL()}
          />
        </DialogSetting>
        {methods.flatMap((method) =>
          Object.entries(method.account ?? {}).map(([name, Setting]) => (
            <Setting key={`${method.href}#${name}`} user={user} />
          )),
        )}
        {buttonSettings.map((Setting, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed at startup
          <Setting key={`buttons#${index}`} user={user} />
        ))}
      </SettingsList>
      {unmanaged.length > 0 ? (
        <p className="border-t px-5 py-3 text-muted-foreground text-xs">
          {`${sentenceList(unmanaged.map((method) => method.title))} also ${unmanaged.length === 1 ? 'signs' : 'sign'} in to this account, no additional set up needed.`}
        </p>
      ) : null}
    </Card>
  );
}
