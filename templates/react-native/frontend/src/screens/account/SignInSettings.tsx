import type { User } from '@nhost/nhost-js/auth';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { buttonSettings, methods } from '@/screens/signin/methods';
import { colors, fontSize } from '@/theme';

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
      <View style={styles.row}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>
          {user.email ?? 'None'}
          {user.email && !user.emailVerified ? (
            <Text style={styles.unverified}> · not verified</Text>
          ) : null}
        </Text>
      </View>
      {methods.flatMap((method) =>
        Object.entries(method.account ?? {}).map(([name, Setting]) => (
          <Setting key={`${method.href}#${name}`} user={user} />
        )),
      )}
      {buttonSettings.map((Setting, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed at startup
        <Setting key={`buttons#${index}`} user={user} />
      ))}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  row: {
    gap: 2,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  value: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  unverified: {
    color: colors.destructive,
  },
  unmanaged: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
});
