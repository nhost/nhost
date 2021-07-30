import { Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { pwnedPassword } from 'hibp';

import { hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { REGISTRATION } from '@config/registration';

type BodyType = {
  ticket?: string;
  oldPassword?: string;
  newPassword: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('inside user password handler');

  const { ticket, oldPassword, newPassword } = req.body;

  if (ticket && oldPassword) {
    return res.boom.badRequest('Both ticket and oldPassword can not be set');
  }

  if (!ticket && !oldPassword) {
    return res.boom.badRequest('Either ticket (x)or oldPassword must be set');
  }

  // check if password is compromised
  if (REGISTRATION.HIBP_ENABLED && (await pwnedPassword(newPassword))) {
    return res.boom.badRequest('Password is too weak');
  }

  const newPasswordHash = await hashPassword(newPassword);

  if (ticket) {
    const ticketUpdateResponse = await gqlSdk.updateUserWhere({
      user: {
        passwordHash: newPasswordHash,
        ticket: null,
      },
      where: {
        ticket: {
          _eq: ticket,
        },
      },
    });

    if (ticketUpdateResponse.updateUsers?.affected_rows !== 1) {
      return res.boom.badRequest('Ticket invalid or expired');
    }
  } else if (oldPassword) {
    // make sure user is signed in

    if (!req.auth?.userId) {
      return res.boom.forbidden('User must be signed in');
    }

    const { userId } = req.auth;

    const { user } = await gqlSdk.user({
      id: userId,
    });

    if (!user) {
      throw new Error('Unable to get user');
    }

    // const oldPasswordHash = await hashPassword(oldPassword);
    // if no password is set, don't care about the old password
    const isPasswordCorrect = !user.passwordHash
      ? true
      : await bcrypt.compare(oldPassword, user.passwordHash);

    if (!isPasswordCorrect) {
      console.log(user.passwordHash);
      console.log(oldPassword);

      return res.boom.badRequest('Incorrect old password');
    }

    // set new password for user
    await gqlSdk.updateUser({
      id: userId,
      user: {
        passwordHash: newPasswordHash,
      },
    });
  } else {
    // should never be able to get to this state
    return res.boom.badRequest('Either ticket (x)or oldPassword must be set');
  }

  return res.send('OK');
};
