import { SessionUser, User } from '@/types';
import { pgClient } from '../postgres-client';

export const getUserByPhoneNumber = async ({
  phoneNumber,
}: {
  phoneNumber: string;
}) => pgClient.getUserByPhoneNumber(phoneNumber);

export const getUser = async ({
  userId,
}: {
  userId: string;
}): Promise<User> => {
  const user = await pgClient.getUserById(userId);

  if (!user) {
    throw new Error('Unable to get user');
  }
  return user;
};

export const getSessionUser = async (params: {
  userId: string;
}): Promise<SessionUser> => {
  const user = await getUser(params);
  const {
    id,
    createdAt,
    roles,
    displayName,
    avatarUrl,
    locale,
    email,
    isAnonymous,
    defaultRole,
    metadata,
    emailVerified,
    phoneNumber,
    phoneNumberVerified,
    activeMfaType,
  } = user;

  return {
    id,
    createdAt,
    roles,
    displayName,
    avatarUrl,
    locale,
    email,
    isAnonymous,
    defaultRole,
    metadata,
    emailVerified,
    phoneNumber,
    phoneNumberVerified,
    activeMfaType,
  };
};

export const getUserByEmail = (email: string) => pgClient.getUserByEmail(email);

export const getUserByTicket = (ticket: string) =>
  pgClient.getUserByTicket(ticket);
