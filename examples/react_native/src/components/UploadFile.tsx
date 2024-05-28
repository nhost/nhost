import React from 'react';
import {useNhostClient} from '@nhost/react';
import {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {pickSingle} from 'react-native-document-picker';

export default function UploadFile() {
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);

  const nhost = useNhostClient();

  const handlePickFile = async () => {
    setLoading(true);
    setUploadedFile(null);

    try {
      const file = await pickSingle();

      const formData = new FormData();
      formData.append('file', file);

      const {error, fileMetadata} = await nhost.storage.upload({formData});

      if (error) {
        throw error;
      }

      setUploadedFile(fileMetadata.processedFiles.at(0));
    } catch (error) {
      Alert.alert('Error', 'Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable style={styles.uploadButtonWrapper} onPress={handlePickFile}>
      {!loading && !uploadedFile && (
        <>
          <Icon name="upload" size={20} />
          <Text style={styles.uploadButtonText}>Pick a file</Text>
        </>
      )}

      {loading && <ActivityIndicator />}

      {uploadedFile && (
        <>
          <Icon name="check-circle" size={20} color="green" />
          <Text style={styles.uploadButtonText}>
            File was uploaded successfully
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  uploadButtonText: {fontWeight: 'bold'},
});
