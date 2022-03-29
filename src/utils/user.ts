import { User } from '@/types';
import { gqlSdk } from './gqlSDK';
import {
  InsertUserMutation,
  InsertUserMutationVariables,
} from './__generated__/graphql-request';

export const getUserByPhoneNumber = async ({
  phoneNumber,
}: {
  phoneNumber: string;
}) => {
  const { users } = await gqlSdk.users({
    where: {
      phoneNumber: {
        _eq: phoneNumber,
      },
    },
  });

  return users[0];
};

export const getUser = async ({
  userId,
}: {
  userId: string;
}): Promise<User> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('Unable to get user');
  }

  const {
    id,
    createdAt,
    displayName,
    email,
    avatarUrl,
    locale,
    isAnonymous,
    defaultRole,
    roles,
    metadata,
  } = user;

  return {
    id,
    createdAt,
    displayName,
    avatarUrl,
    locale,
    email,
    isAnonymous,
    defaultRole,
    roles: roles.map((role) => role.role),
    metadata,
  };
};

type UserInput = InsertUserMutationVariables['user'];
type UserOutput = NonNullable<InsertUserMutation['insertUser']>;

export const insertUser = async (user: UserInput): Promise<UserOutput> => {
  const { insertUser } = await gqlSdk.insertUser({
    user,
  });
  if (!insertUser) {
    throw new Error('Could not insert user');
  }
  return insertUser;
};
