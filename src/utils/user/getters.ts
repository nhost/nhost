import { User } from '@/types';
import { gqlSdk } from '../gql-sdk';

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

export const getUserByEmail = async (email: string) => {
  const { users } = await gqlSdk.users({
    where: {
      email: {
        _eq: email,
      },
    },
  });

  return users[0];
};

export const getUserByTicket = async (ticket: string) => {
  const now = new Date();

  const { users } = await gqlSdk.users({
    where: {
      _and: [
        {
          ticket: {
            _eq: ticket,
          },
        },
        {
          ticketExpiresAt: {
            _gt: now,
          },
        },
      ],
    },
  });

  if (users.length !== 1) {
    return null;
  }

  return users[0];
};
