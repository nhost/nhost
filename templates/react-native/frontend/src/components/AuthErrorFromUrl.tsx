import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import AuthErrorNotice from '@/components/AuthErrorNotice';

/** Shows `AuthErrorNotice` for the screen's own URL, on any screen. */
export default function AuthErrorFromUrl() {
  const { error } = useLocalSearchParams<{ error?: string | string[] }>();

  if (!error) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <AuthErrorNotice error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    marginBottom: 16,
  },
});
