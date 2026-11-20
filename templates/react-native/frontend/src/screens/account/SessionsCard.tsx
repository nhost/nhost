import { StyleSheet, Text } from 'react-native';
import { SettingsItem, SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';
import { useLoad } from '@/lib/useLoad';
import { listSessions } from '@/screens/account/actions';
import SessionList from '@/screens/account/SessionList';
import { sortSessions } from '@/screens/account/sessions';
import { colors, fontSize } from '@/theme';

/** The account's sessions, each with a way to end it. */
export default function SessionsCard() {
  const loaded = useLoad(listSessions);

  return (
    <Card style={styles.card}>
      <Text role="heading" style={styles.heading}>
        Sessions
      </Text>
      <SettingsList>
        {!loaded ? (
          <SettingsItem style={styles.item}>
            <Text style={styles.loading}>Loading…</Text>
          </SettingsItem>
        ) : loaded.error ? (
          <SettingsItem style={styles.item}>
            <Text role="alert" style={styles.error}>
              {loaded.error}
            </Text>
          </SettingsItem>
        ) : (
          <SessionList sessions={sortSessions(loaded.sessions ?? [])} />
        )}
      </SettingsList>
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
  item: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  loading: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
