import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../lib/nhost/AuthProvider';

interface MFASettingsProps {
  initialMfaEnabled: boolean;
}

export default function MFASettings({ initialMfaEnabled }: MFASettingsProps) {
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean>(initialMfaEnabled);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { nhost } = useAuth();

  // Update internal state when prop changes
  useEffect(() => {
    if (initialMfaEnabled !== isMfaEnabled) {
      setIsMfaEnabled(initialMfaEnabled);
    }
  }, [initialMfaEnabled, isMfaEnabled]);

  // MFA setup states
  const [isSettingUpMfa, setIsSettingUpMfa] = useState<boolean>(false);
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [qrCodeModalVisible, setQrCodeModalVisible] = useState<boolean>(false);

  // Disabling MFA states
  const [isDisablingMfa, setIsDisablingMfa] = useState<boolean>(false);
  const [disableVerificationCode, setDisableVerificationCode] =
    useState<string>('');

  // Begin MFA setup process
  const handleEnableMfa = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate TOTP secret
      const response = await nhost.auth.changeUserMfa();
      setTotpSecret(response.body.totpSecret);
      setQrCodeUrl(response.body.imageUrl);
      setIsSettingUpMfa(true);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`An error occurred while enabling MFA: ${errMessage}`);
      Alert.alert('Error', `Failed to enable MFA: ${errMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify TOTP and enable MFA
  const handleVerifyTotp = async () => {
    if (!verificationCode) {
      setError('Please enter the verification code');
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Verify and activate MFA
      await nhost.auth.verifyChangeUserMfa({
        activeMfaType: 'totp',
        code: verificationCode,
      });

      setIsMfaEnabled(true);
      setIsSettingUpMfa(false);
      setSuccess('MFA has been successfully enabled.');
      Alert.alert('Success', 'MFA has been successfully enabled.');
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`An error occurred while verifying the code: ${errMessage}`);
      Alert.alert('Error', `Failed to verify code: ${errMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Show disable MFA confirmation
  const handleShowDisableMfa = () => {
    setIsDisablingMfa(true);
    setError(null);
    setSuccess(null);
  };

  // Disable MFA
  const handleDisableMfa = async () => {
    if (!disableVerificationCode) {
      setError('Please enter your verification code to confirm');
      Alert.alert('Error', 'Please enter your verification code to confirm');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Disable MFA by setting activeMfaType to empty string
      await nhost.auth.verifyChangeUserMfa({
        activeMfaType: '',
        code: disableVerificationCode,
      });

      setIsMfaEnabled(false);
      setIsDisablingMfa(false);
      setDisableVerificationCode('');
      setSuccess('MFA has been successfully disabled.');
      Alert.alert('Success', 'MFA has been successfully disabled.');
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred while disabling MFA: ${error.message}`);
      Alert.alert('Error', `Failed to disable MFA: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel MFA setup
  const handleCancelMfaSetup = () => {
    setIsSettingUpMfa(false);
    setTotpSecret('');
    setQrCodeUrl('');
    setVerificationCode('');
  };

  // Cancel MFA disable
  const handleCancelMfaDisable = () => {
    setIsDisablingMfa(false);
    setDisableVerificationCode('');
    setError(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Multi-Factor Authentication</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      {isSettingUpMfa ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.contentContainer}
            >
              <Text style={styles.instructionText}>
                Scan this QR code with your authenticator app (e.g., Google
                Authenticator, Authy):
              </Text>

              {qrCodeUrl && (
                <TouchableOpacity
                  style={styles.qrCodeContainer}
                  onPress={() => setQrCodeModalVisible(true)}
                >
                  <Image
                    source={{ uri: qrCodeUrl }}
                    style={styles.qrCode}
                    resizeMode="contain"
                  />
                  <Text style={styles.copyHint}>(Tap to enlarge)</Text>
                </TouchableOpacity>
              )}

              <Modal
                animationType="slide"
                transparent={true}
                visible={qrCodeModalVisible}
                onRequestClose={() => setQrCodeModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Scan QR Code</Text>
                    <Image
                      source={{ uri: qrCodeUrl }}
                      style={styles.largeQrCode}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setQrCodeModalVisible(false)}
                    >
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Text style={styles.instructionText}>
                Or manually enter this secret key:
              </Text>
              <TouchableOpacity
                style={styles.secretContainer}
                onPress={async () => {
                  await Clipboard.setStringAsync(totpSecret);
                  Alert.alert('Copied', 'Secret key copied to clipboard');
                }}
              >
                <Text style={styles.secretText}>{totpSecret}</Text>
                <Text style={styles.copyHint}>(Tap to copy)</Text>
              </TouchableOpacity>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>

              <View style={[styles.buttonRow, { marginBottom: 30 }]}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    (!verificationCode || isLoading) && styles.disabledButton,
                  ]}
                  onPress={handleVerifyTotp}
                  disabled={isLoading || !verificationCode}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify and Enable</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleCancelMfaSetup}
                  disabled={isLoading}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      ) : isDisablingMfa ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.contentContainer}
            >
              <Text style={styles.instructionText}>
                To disable Multi-Factor Authentication, please enter the current
                verification code from your authenticator app.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Current Verification Code</Text>
                <TextInput
                  style={styles.input}
                  value={disableVerificationCode}
                  onChangeText={setDisableVerificationCode}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>

              <View style={[styles.buttonRow, { marginBottom: 30 }]}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    (!disableVerificationCode || isLoading) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleDisableMfa}
                  disabled={isLoading || !disableVerificationCode}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Confirm Disable</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleCancelMfaDisable}
                  disabled={isLoading}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.contentContainer}>
          <Text style={styles.instructionText}>
            Multi-Factor Authentication adds an extra layer of security to your
            account by requiring a verification code from your authenticator app
            when signing in.
          </Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text
              style={[
                styles.statusValue,
                isMfaEnabled ? styles.enabledText : styles.disabledText,
              ]}
            >
              {isMfaEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>

          {isMfaEnabled ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                isLoading && styles.disabledButton,
              ]}
              onPress={handleShowDisableMfa}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Text style={styles.secondaryButtonText}>Disable MFA</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                isLoading && styles.disabledButton,
              ]}
              onPress={handleEnableMfa}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Enable MFA</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  contentContainer: {
    marginTop: 10,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  successText: {
    color: '#047857',
    fontSize: 14,
  },
  instructionText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 16,
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 10,
    marginVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    width: Dimensions.get('window').width * 0.9,
  },
  largeQrCode: {
    width: Dimensions.get('window').width * 0.7,
    height: Dimensions.get('window').width * 0.7,
    marginVertical: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  closeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 6,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  secretContainer: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  secretText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  copyHint: {
    fontSize: 12,
    color: '#6366f1',
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  enabledText: {
    color: '#10b981',
  },
  disabledText: {
    color: '#f59e0b',
  },
});
