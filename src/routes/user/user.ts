import { RequestHandler } from 'express';

import { getSessionUser } from '@/utils';

export const userHandler: RequestHandler = async (
  req,
  res
): Promise<unknown> => {
  const { userId } = req.auth as RequestAuth;

  const user = await getSessionUser({ userId });

  return res.send({
    ...user,
  });
};
