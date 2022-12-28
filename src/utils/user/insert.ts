import { User } from '@/types';
import { pgClient } from '../postgres-client';

export const insertUser = async (user: Partial<User>): Promise<User> => {
  const insertUser = await pgClient.insertUser(user);

  if (!insertUser) {
    throw new Error('Could not insert user');
  }

  return insertUser;
};
