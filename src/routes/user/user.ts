import { RequestHandler } from 'express';

import { getUser } from '@/utils';

export const userHandler: RequestHandler = async (
  req,
  res
): Promise<unknown> => {
  const { userId } = req.auth as RequestAuth;

  const user = await getUser({ userId });

  return res.send({
    ...user,
  });
};
