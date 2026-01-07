import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './lib/nhost/AuthProvider';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nhost SDK Demo</Text>
      <Text style={styles.subtitle}>React Native Example</Text>

      <View style={styles.contentContainer}>
        {isAuthenticated ? (
          <>
            <Text style={styles.welcomeText}>
              Welcome back, {user?.displayName || user?.email || 'User'}!
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.buttonText}>Go to Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => router.push('/upload')}
            >
              <Text style={styles.buttonText}>File Upload</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/signin')}
            >
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => router.push('/signup')}
            >
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    color: '#666',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  authButtons: {
    width: '100%',
    gap: 15,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButton: {
    backgroundColor: '#818cf8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
