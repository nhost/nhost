import { gql } from 'graphql-request';
import { client, gqlSdk } from '@/utils/gqlSDK';
import { TOKEN } from '@config/token';
import { REGISTRATION } from '@config/registration';

type InsertProfileParams = {
  userId: string;
  profile: null | { [key: string]: unknown };
};

export const insertProfile = async ({
  userId,
  profile,
}: InsertProfileParams) => {
  try {
    if (!profile) {
      return;
    }

    const insertProfile = gql`
      mutation insertProfile($profile: profiles_insert_input!) {
        insertProfile(object: $profile) {
          userId
        }
      }
    `;

    // check profile keys
    for (const key in profile) {
      if (!REGISTRATION.REGISTRATION_PROFILE_FIELDS.includes(key)) {
        console.error(`profile key ${key} is not allowed`);
        throw new Error(`profile key ${key} is not allowed`);
      }
    }

    await client.request(insertProfile, {
      profile: {
        userId: userId,
        ...profile,
      },
    });
  } catch (error) {
    // delete previously inserted user if unable to insert profile
    await gqlSdk.deleteUser({
      userId,
    });

    console.error(`Unable to insert profile`);
    throw new Error('Unable to insert profile');
  }
};

type GetProfileFieldsForAccessToken = {
  userId: string;
};

export const getProfileFieldsForAccessToken = async ({
  userId,
}: GetProfileFieldsForAccessToken) => {
  const getProfile = gql`
    query getProfile($userId: uuid!) {
      profile(userId: $userId) {
        ${TOKEN.PROFILE_SESSION_VARIABLE_FIELDS.join('\n')}
      }
    }
  `;

  const { profile } = await client.request(getProfile, {
    userId,
  });

  return profile;
};
