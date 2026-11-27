import type { User } from '@nhost/nhost-js/auth';
import { StyleSheet, Text } from 'react-native';
import { DialogSetting, SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';
import ChangeEmailForm from '@/screens/account/ChangeEmailForm';
import { buttonSettings, methods } from '@/screens/signin/methods';
import { colors, fontSize, inset } from '@/theme';

/** Every sign-in method, as the account screen shows it. */

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
    <Card style={styles.card}>
      <Text role="heading" style={styles.heading}>
        Sign-in
      </Text>
      <SettingsList>
        <DialogSetting
          label="Email"
          value={
            user.email ? (
              <>
                {user.email}
                {user.emailVerified ? null : (
                  <Text style={styles.unverified}> · not verified</Text>
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
          <ChangeEmailForm email={user.email} verified={user.emailVerified} />
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
        <Text style={styles.unmanaged}>
          {`${sentenceList(unmanaged.map((method) => method.title))} also ${unmanaged.length === 1 ? 'signs' : 'sign'} in to this account, no additional set up needed.`}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingVertical: 0,
  },
  heading: {
    paddingHorizontal: inset.card,
    paddingTop: 16,
    paddingBottom: 4,
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  unverified: {
    color: colors.destructive,
  },
  unmanaged: {
    paddingHorizontal: inset.card,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
});
