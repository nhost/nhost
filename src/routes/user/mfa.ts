import { gqlSdk } from '@/utils/gqlSDK';
import { RequestHandler } from 'express';
import { authenticator } from 'otplib';

export const userMFAHandler: RequestHandler<
  {},
  {},
  {
    code: string;
    activeMfaType: null | 'totp'; // | 'sms';
  }
> = async (req, res) => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send('Incorrect access token');
  }

  const { code, activeMfaType } = req.body;

  // TODO joi validation
  if (activeMfaType && !['totp'].includes(activeMfaType)) {
    return res.boom.badRequest(
      'Incorrect activeMfaType. Must be emtpy string or one of: [totp]'
    );
  }

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('user could not be fetched');
  }

  if (!activeMfaType) {
    // user wants to deactivate any active MFA type
    if (!user.activeMfaType) {
      return res.boom.badRequest('There is no active MFA set for the user');
    }

    if (user.activeMfaType === 'totp') {
      if (!user.totpSecret) {
        return res.boom.internal('totp secret is not set for user');
      }

      if (!authenticator.check(code, user.totpSecret)) {
        return res.boom.unauthorized('Invalid code');
      }
    }

    // if (user.activeMfaType === 'sms') {
    // }

    await gqlSdk.updateUser({
      id: userId,
      user: {
        activeMfaType: null,
      },
    });

    return res.send('ok');
  }

  // activate MFA
  if (activeMfaType === 'totp') {
    if (user.activeMfaType === 'totp') {
      return res.boom.badRequest('TOTP MFA already active');
    }

    if (!user.totpSecret) {
      return res.boom.internal('otp secret is not set for user');
    }

    if (!authenticator.check(code, user.totpSecret)) {
      return res.boom.unauthorized('Invalid code');
    }
  }
  // else if (activeMfaType === 'sms') {
  // }

  await gqlSdk.updateUser({
    id: userId,
    user: {
      activeMfaType,
    },
  });

  return res.send('OK');
};
