import { gql } from "graphql-request";
import { client, gqlSdk } from "@/utils/gqlSDK";
import { TOKEN } from "@config/token";

type InsertProfileParams = {
  userId: string;
  profile: object | null;
};

export const insertProfile = async ({
  userId,
  profile,
}: InsertProfileParams) => {
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

  try {
    await client.request(insertProfile, {
      profile: {
        userId: userId,
        ...profile,
      },
    });
  } catch (error) {
    // roll back
    // delete previous inserted user if inserting the profile fails.
    gqlSdk.deleteUser({
      userId,
    });

    console.error(error);
    throw new Error("Could not insert profile");
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
        ${TOKEN.PROFILE_SESSION_VARIABLE_FIELDS.join("\n")}
      }
    }
  `;

  const { profile } = await client.request(getProfile, {
    userId,
  });

  return profile;
};
