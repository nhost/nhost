import { RequestHandler } from 'express';
import { authenticator } from 'otplib';

import { createQR, gqlSdk, ENV } from '@/utils';
import { sendError } from '@/errors';

export const mfatotpGenerateHandler: RequestHandler<
  {},
  { imageUrl: string; totpSecret: string },
  {}
> = async (req, res) => {
  if (!ENV.AUTH_MFA_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }
  const { userId } = req.auth as RequestAuth;

  const totpSecret = authenticator.generateSecret();
  const otpAuth = authenticator.keyuri(
    userId,
    ENV.AUTH_MFA_TOTP_ISSUER,
    totpSecret
  );

  await gqlSdk.updateUser({
    id: userId,
    user: {
      totpSecret,
    },
  });

  const imageUrl = await createQR(otpAuth);

  return res.send({ imageUrl, totpSecret });
};
