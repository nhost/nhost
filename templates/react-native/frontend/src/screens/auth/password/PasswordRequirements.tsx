import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { passwordRequirements } from '@/screens/auth/password/requirements';
import { colors, fontSize } from '@/theme';

/** The rules a new password has to meet, ticked off as it is typed. */
export default function PasswordRequirements({
  password,
  confirm,
  style,
}: {
  password: string;
  confirm?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.list, style]}>
      {passwordRequirements(password, confirm).map((rule) => (
        // A dash while a rule is still open, so the list does not read as a
        // row of failures before anything is typed. Green once it is met.
        <View
          key={rule.label}
          accessible
          accessibilityLabel={`${rule.label}, ${rule.met ? 'met' : 'not met'}`}
          style={styles.rule}
        >
          <Text style={[styles.mark, rule.met && styles.met]}>
            {rule.met ? '✓' : '–'}
          </Text>
          <Text style={[styles.label, rule.met && styles.met]}>
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    alignItems: 'center',
    gap: 4,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mark: {
    width: 10,
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  met: {
    color: colors.success,
  },
});
