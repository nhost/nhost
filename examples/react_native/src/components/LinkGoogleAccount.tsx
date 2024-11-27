import {gql} from '@apollo/client';
import Button from '@components/Button';
import {
  useAuthenticationStatus,
  useLinkIdToken,
  useNhostClient,
} from '@nhost/react';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-simple-toast';

GoogleSignin.configure({
  webClientId: process.env.GOOGLE_CLIENT_ID,
  iosClientId: process.env.GOOGLE_CLIENT_ID,
});

export default function LinkGoogleAccount() {
  const nhost = useNhostClient();
  const {linkIdToken} = useLinkIdToken();
  const {isAuthenticated} = useAuthenticationStatus();
  const [loading, setLoading] = useState(false);
  const [linkedWithGoogle, setLinkedWithGoogle] = useState(false);

  const checkIfGoogleLinked = useCallback(async () => {
    try {
      setLoading(true);
      const {data, error} = await nhost.graphql.request<{
        authUserProviders: {id: string; providerId: string}[];
      }>(gql`
        query getAuthUserProviders {
          authUserProviders {
            id
            providerId
          }
        }
      `);

      if (error) {
        Toast.show(
          'Failed to fetch query user authentication providers',
          Toast.SHORT,
        );
        return;
      }

      if (data) {
        setLinkedWithGoogle(
          data.authUserProviders?.some(elem => elem.providerId === 'google'),
        );
      }
    } catch (error) {
      Toast.show(
        'Failed to fetch query user authentication providers',
        Toast.SHORT,
      );
    } finally {
      setLoading(false);
    }
  }, [nhost]);

  useEffect(() => {
    if (isAuthenticated) {
      checkIfGoogleLinked();
    }
  }, [isAuthenticated, checkIfGoogleLinked]);

  const handleLinkGoogleAccount = async () => {
    try {
      setLoading(true);

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const idToken = response?.data?.idToken as string;

        const {isError, isSuccess} = await linkIdToken({
          provider: 'google',
          idToken,
        });

        if (isError) {
          Toast.show('An unexpected error happened', Toast.SHORT);
        }

        if (isSuccess) {
          Toast.show('Google account was linked successfully', Toast.SHORT);
          await checkIfGoogleLinked();
        }
      } else {
        // sign in was cancelled by user
        Toast.show('Sign in was cancelled by user', Toast.SHORT);
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.IN_PROGRESS:
            // operation (eg. sign in) already in progress
            Toast.show('Sign in already in progress', Toast.SHORT);
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            // Android only, play services not available or outdated
            Toast.show(
              'Google play services not available or outdated',
              Toast.SHORT,
            );
            break;
          default:
            // some other error happened
            Toast.show('An unexpected error happened', Toast.SHORT);
        }
      } else {
        // an error that's not related to google sign in occurred
        Toast.show('An unexpected error happened', Toast.SHORT);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogleAccount = async () => {
    try {
      setLoading(true);

      const {error} = await nhost.graphql.request(
        gql`
          mutation deleteAuthUserProvider($providerId: String!) {
            deleteAuthUserProviders(where: {providerId: {_eq: $providerId}}) {
              affected_rows
            }
          }
        `,
        {
          providerId: 'google',
        },
      );

      if (!error) {
        Toast.show('Google Account was unlinked successfully', Toast.SHORT);
        await checkIfGoogleLinked();
        return;
      }

      Toast.show('Failed to unlink auth user provider', Toast.SHORT);
    } catch (error) {
      Toast.show('Failed to unlink auth user provider', Toast.SHORT);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.unlinkGoogleContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  if (linkedWithGoogle) {
    return (
      <View style={styles.unlinkGoogleContainer}>
        <View style={styles.linkedWithGoogleContainer}>
          <Icon name="google" color="#333" size={20} />
          <Text style={styles.linkedWithGoogleText}>Linked with Google</Text>
        </View>

        <Button
          label={
            <View style={styles.labelWrapper}>
              <Text style={styles.text}>Unlink Google Account</Text>
            </View>
          }
          color="#d97d73"
          onPress={handleUnlinkGoogleAccount}
        />
      </View>
    );
  }

  return (
    <Button
      disabled={loading || linkedWithGoogle}
      label={
        <View style={styles.labelWrapper}>
          <Icon name="google" color="white" size={20} />
          <Text style={styles.text}>Link Google Account</Text>
        </View>
      }
      color="#de5246"
      onPress={handleLinkGoogleAccount}
    />
  );
}

const styles = StyleSheet.create({
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
  linkedWithGoogle: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#de524688',
    gap: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkGoogleContainer: {
    gap: 16,
    padding: 16,
    flexDirection: 'column',
    backgroundColor: 'white',
  },
  linkedWithGoogleContainer: {
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedWithGoogleText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
