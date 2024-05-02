import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {pick} from 'react-native-document-picker';
import {useNhostClient} from '@nhost/react';
import {useState} from 'react';

export default function Storage() {
  const nhost = useNhostClient();
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    setLoading(true);

    try {
      const [file] = await pick();

      const formData = new FormData();
      formData.append('file', file);

      const result = await nhost.storage.upload({formData});
    } catch (err: unknown) {
      // see error handling
      Alert.alert('Error', 'Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.uploadButtonWrapper} onPress={handlePickFile}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Icon name="upload" size={20} />
            <Text style={{fontWeight: 'bold'}}>Upload File</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 20,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadButtonWrapper: {
    height: 200,
    borderRadius: 10,
    backgroundColor: 'white',

    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'lightgray',
  },
});
