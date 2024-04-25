import {useNhostClient, useUserData} from '@nhost/react';
import {Text, View} from 'react-native';
import Button from '../components/Button';
import {useState} from 'react';

export default function Profile() {
  const user = useUserData();
  const nhost = useNhostClient();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const {error} = await nhost.auth.signOut();
    setLoading(false);
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        gap: 10,
        backgroundColor: 'beige',
      }}>
      <Text>{user?.displayName}</Text>
      <Button label="Sign out" loading={loading} onPress={handleSignOut} />
    </View>
  );
}
