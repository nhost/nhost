import Joi from 'joi';
import { Session, User } from '../types';
import {
  defaultRole,
  displayName,
  email,
  locale,
  metadata,
  refreshToken,
  userId,
} from './fields';

// ******** THE ABOVE MODELS ARE USED FOR GENERATING OPENAPI SCHEMAS ******** //
export const UserModel = Joi.object<User>({
  id: userId,
  createdAt: Joi.date().required(),
  displayName: displayName.required(),
  avatarUrl: Joi.string().required(),
  locale: locale.required(),
  email: email.required(),
  isAnonymous: Joi.boolean().required().default(false),
  defaultRole: defaultRole.required(),
  metadata: metadata.required(),
}).meta({ className: 'User' });

export const SessionModel = Joi.object<Session>({
  accessToken: Joi.string().required(),
  accessTokenExpiresIn: Joi.number().required(),
  refreshToken,
  user: UserModel,
}).meta({ className: 'Session' });

export const MfaModel = Joi.object({ ticket: Joi.string() }).meta({
  className: 'Mfa',
});

export const SessionPayload = Joi.object({
  session: SessionModel,
  mfa: MfaModel,
}).meta({ className: 'SessionPayload' });

export const TotpPayload = Joi.object({
  imageUrl: Joi.string().required().description('Data URL of the QR code'),
  totpSecret: Joi.string().required().description('TOTP secret'),
}).meta({ className: 'TotpPayload' });

export const EmailAlreadyInUseError = Joi.object({
  statusCode: Joi.number().valid(409),
  error: Joi.string().valid('Conflict'),
  message: Joi.string().valid('Email already in use'),
}).meta({ className: 'EmailAlreadyInUseError' });

export const UnauthenticatedError = Joi.object({
  statusCode: Joi.number().valid(401),
  error: Joi.string().valid('Unauthorized'),
  message: Joi.string(),
}).meta({ className: 'UnauthenticatedError' });

export const DisabledUserError = Joi.object({
  statusCode: Joi.number().valid(401),
  error: Joi.string().valid('Unauthorized'),
  message: Joi.string().valid('User is disabled'),
}).meta({ className: 'DisabledUserError' });

export const UserNotFoundError = Joi.object({
  statusCode: Joi.number().valid(401),
  error: Joi.string().valid('Unauthorized'),
  message: Joi.string().valid('Incorrect email or password'),
}).meta({ className: 'UserNotFoundError' });

export const UserNotVerifiedError = Joi.object({
  statusCode: Joi.number().valid(401),
  error: Joi.string().valid('Unauthorized'),
  message: Joi.string().valid('Email is not verified'),
}).meta({ className: 'UserNotVerifiedError' });

export const UserHasNoPasswordError = Joi.object({
  statusCode: Joi.number().valid(401),
  error: Joi.string().valid('Unauthorized'),
  message: Joi.string().valid('Incorrect email or password'),
}).meta({ className: 'UserHasNoPasswordError' });

export const PasswordEmailSigninError = DisabledUserError.concat(
  UserNotFoundError
)
  .concat(UserNotVerifiedError)
  .concat(UserHasNoPasswordError)
  .meta({ className: 'PasswordEmailSigninError' });
