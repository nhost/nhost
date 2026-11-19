import { StyleSheet, Text, View } from 'react-native';
import CenteredLayout from '@/components/CenteredLayout';
import { colors, fontSize } from '@/theme';

/** What any path without a screen shows, as Next's default not-found page. */
export default function NotFound() {
  return (
    <CenteredLayout>
      <View style={styles.row}>
        <Text role="heading" style={styles.status}>
          404
        </Text>
        <Text style={styles.message}>This page could not be found.</Text>
      </View>
    </CenteredLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  status: {
    paddingRight: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    color: colors.foreground,
    fontSize: fontSize['2xl'],
    fontWeight: '500',
  },
  message: {
    color: colors.foreground,
    fontSize: fontSize.sm,
  },
});
