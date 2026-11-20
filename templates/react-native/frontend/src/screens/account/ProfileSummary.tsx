import type { User } from '@nhost/nhost-js/auth';
import { StyleSheet, Text, View } from 'react-native';
import UserAvatar from '@/components/UserAvatar';
import { Card } from '@/components/ui/card';
import { colors, fontSize, monospace } from '@/theme';

// A fixed zone rather than the device's: the day it says has to be the one the
// auth service stored.
const joined = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export default function ProfileSummary({ user }: { user: User }) {
  return (
    <Card style={styles.card}>
      <UserAvatar displayName={user.displayName} size={72} />

      {/* The id, role and locale are what a developer reads and the account's
          owner mostly does not, so they are small. */}
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {user.displayName || 'No display name'}
        </Text>
        <Text style={styles.id} numberOfLines={1} ellipsizeMode="middle">
          {user.id}
        </Text>
        <Text style={styles.joined}>
          Joined {joined.format(new Date(user.createdAt))}
        </Text>
        {/* The default role on its own: `user.roles` always carries `me` as
            well, which says nothing here. */}
        <Text style={styles.meta} numberOfLines={1}>
          Role <Text style={styles.value}>{user.defaultRole}</Text> · Locale{' '}
          <Text style={styles.value}>{user.locale}</Text>
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 20,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    color: colors.foreground,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  id: {
    color: colors.mutedForeground,
    fontFamily: monospace,
    fontSize: fontSize.xs,
  },
  joined: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  meta: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    opacity: 0.7,
  },
  value: {
    fontWeight: '500',
  },
});
