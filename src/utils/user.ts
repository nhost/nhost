import { User } from '@/types';
import { gqlSdk } from './gqlSDK';

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
    throw new Error('Unable to get suer');
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
  } = user;

  const userRoles = roles.map((role) => role.role);

  return {
    id,
    createdAt,
    displayName,
    avatarUrl,
    locale,
    email,
    isAnonymous,
    defaultRole,
    roles: userRoles,
  };
};
