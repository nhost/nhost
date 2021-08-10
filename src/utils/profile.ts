import { Response } from 'express';
import { gql } from 'graphql-request';

import { client, gqlSdk } from '@/utils/gqlSDK';
import { ENV } from './env';

type Profile = {
  [key: string]: string | number | boolean;
};

type IsProfileValidParams = {
  profile: Profile | null;
  res: Response;
};

export const isProfileValid = async ({
  profile,
  res,
}: IsProfileValidParams): Promise<boolean> => {
  if (ENV.REGISTRATION_PROFILE_FIELDS.length && !profile) {
    res.boom.badRequest('Profile required');
    return false;
  }

  // check profile keys

  for (const key in profile) {
    if (!ENV.REGISTRATION_PROFILE_FIELDS.includes(key)) {
      res.boom.badRequest(`profile key ${key} is not allowed`);
      return false;
    }
  }

  return true;
};

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

    console.log('inside insert profile');

    const insertProfile = gql`
      mutation insertProfile($profile: profiles_insert_input!) {
        insertProfile(object: $profile) {
          userId
        }
      }
    `;

    await client.request(insertProfile, {
      profile: {
        userId: userId, // TODO: Maybe skip this?
        ...profile,
      },
    });
  } catch (error) {
    console.log('failed to insert profile');
    console.log({ error });

    console.log('profile:');
    console.log(profile);

    // if no profile was provided that it's okey that this query fails.
    // if (!profile) {
    //   return;
    // }
    // delete previously inserted user if unable to insert profile
    await gqlSdk.deleteUser({
      userId,
    });

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
        ${ENV.PROFILE_SESSION_VARIABLE_FIELDS.join('\n')}
      }
    }
  `;

  const { profile } = await client.request(getProfile, {
    userId,
  });

  return profile;
};
