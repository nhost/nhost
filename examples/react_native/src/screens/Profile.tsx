import {useNhostClient, useUserData} from '@nhost/react';
import {StyleSheet, Text, View} from 'react-native';
import Button from '../components/Button';
import {useState} from 'react';

export default function Profile() {
  const user = useUserData();
  const nhost = useNhostClient();

  return (
    <View style={styles.wrapper}>
      <Text>{user?.displayName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 12,
    gap: 10,
    backgroundColor: 'beige',
  },
});
