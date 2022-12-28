import { User } from '@/types';
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

export const getUserByEmail = (email: string) => pgClient.getUserByEmail(email);

export const getUserByTicket = (ticket: string) =>
  pgClient.getUserByTicket(ticket);
