import {gql} from '@apollo/client';
import Button from '@components/Button';
import {
  useAuthenticationStatus,
  useLinkIdToken,
  useNhostClient,
} from '@nhost/react';
import {appleAuth} from '@invertase/react-native-apple-authentication';
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-simple-toast';

export default function LinkAppleAccount() {
  const nhost = useNhostClient();
  const {linkIdToken} = useLinkIdToken();
  const {isAuthenticated} = useAuthenticationStatus();
  const [loading, setLoading] = useState(false);
  const [linkedWithApple, setLinkedWithApple] = useState(false);

  const checkIfAppleLinked = useCallback(async () => {
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
        setLinkedWithApple(
          data.authUserProviders?.some(elem => elem.providerId === 'apple'),
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
      checkIfAppleLinked();
    }
  }, [isAuthenticated, checkIfAppleLinked]);

  const handleLinkAppleAccount = async () => {
    try {
      setLoading(true);

      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const {identityToken, nonce} = appleAuthRequestResponse;

      if (identityToken && nonce) {
        const {isError, isSuccess, error} = await linkIdToken({
          provider: 'apple',
          idToken: identityToken,
          nonce,
        });

        if (isError) {
          Toast.show(
            error?.error ?? 'An unexpected error happened',
            Toast.SHORT,
          );
        }

        if (isSuccess) {
          Toast.show('Apple account was linked successfully', Toast.SHORT);
          await checkIfAppleLinked();
        }
      } else {
        Toast.show('An unexpected error happened', Toast.SHORT);
      }
    } catch (error) {
      Toast.show('An unexpected error happened', Toast.SHORT);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkAppleAccount = async () => {
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
          providerId: 'apple',
        },
      );

      if (!error) {
        Toast.show('Apple Account was unlinked successfully', Toast.SHORT);
        await checkIfAppleLinked();
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
      <View style={styles.unlinkAppleContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  if (linkedWithApple) {
    return (
      <View style={styles.unlinkAppleContainer}>
        <View style={styles.linkedWithAppleContainer}>
          <Icon name="apple" color="#333" size={20} />
          <Text style={styles.linkedWithAppleText}>Linked with Apple</Text>
        </View>

        <Button
          label={
            <View style={styles.labelWrapper}>
              <Text style={styles.text}>Unlink Apple Account</Text>
            </View>
          }
          color="#333"
          onPress={handleUnlinkAppleAccount}
        />
      </View>
    );
  }

  return (
    <Button
      disabled={loading || linkedWithApple}
      label={
        <View style={styles.labelWrapper}>
          <Icon name="apple" color="white" size={20} />
          <Text style={styles.text}>Link Apple Account</Text>
        </View>
      }
      color="#333"
      onPress={handleLinkAppleAccount}
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
  linkedWithApple: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#333',
    gap: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkAppleContainer: {
    gap: 16,
    padding: 16,
    flexDirection: 'column',
    backgroundColor: 'white',
  },
  linkedWithAppleContainer: {
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedWithAppleText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
