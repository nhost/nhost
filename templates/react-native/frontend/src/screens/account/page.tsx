import { StyleSheet, Text } from 'react-native';
import CenteredLayout from '@/components/CenteredLayout';
import { colors, fontSize } from '@/theme';

/** The signed-in user's account. */
export default function Account() {
  return (
    <CenteredLayout>
      <Text role="heading" style={styles.title}>
        Account
      </Text>
    </CenteredLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.foreground,
    fontSize: fontSize['2xl'],
    fontWeight: '600',
    textAlign: 'center',
  },
});
