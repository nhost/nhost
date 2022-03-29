import { RequestHandler } from 'express';

import { createQR } from '@/helpers';
import { authenticator } from 'otplib';
import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';

export const mfatotpGenerateHandler: RequestHandler<
  {},
  { imageUrl: string; totpSecret: string },
  {}
> = async (req, res) => {
  if (!ENV.AUTH_MFA_ENABLED) {
    return res.boom.notFound();
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
