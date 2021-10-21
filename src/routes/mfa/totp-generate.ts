import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { createQR } from '@/helpers';
import { authenticator } from 'otplib';
import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';

type BodyType = {};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const mfatotpGenerateHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('mfa totp generate handler');

  if (!ENV.AUTH_MFA_ENABLED) {
    return res.boom.notFound();
  }

  if (!req.auth) {
    return res.boom.unauthorized('User is not logged in');
  }

  const { userId } = req.auth;

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

  console.log({ imageUrl });
  console.log({ totpSecret });

  return res.send({ imageUrl, totpSecret });
};
