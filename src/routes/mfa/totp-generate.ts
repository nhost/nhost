import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { MFA } from '@config/index';
import { createQR } from '@/helpers';
import { authenticator } from 'otplib';
import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  ticket: string;
  code: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const mfatotpGenerateHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('mfa totp generate handler');

  if (!MFA.ENABLED) {
    return res.boom.notFound();
  }

  if (!req.auth) {
    return res.boom.unauthorized('User is not logged in');
  }

  const { userId } = req.auth;

  const totpSecret = authenticator.generateSecret();
  const otpAuth = authenticator.keyuri(userId, MFA.OTP_ISSUER, totpSecret);

  await gqlSdk.updateUser({
    id: userId,
    user: {
      totpSecret,
    },
  });

  const imageUrl = await createQR(otpAuth);

  return res.send({ imageUrl, totpSecret });
};
