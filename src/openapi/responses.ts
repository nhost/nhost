import { ErrorPayload } from '@/errors';
import {
  activeMfaType,
  allowedRoles,
  defaultRole,
  displayName,
  email,
  Joi,
  locale,
  metadata,
  refreshToken,
  userId,
} from '@/validation';
import { StatusCodes } from 'http-status-codes';
import { Session, User } from '../types';

// ******** THE FOLLOWING MODELS ARE USED FOR GENERATING OPENAPI SCHEMAS ******** //
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
  activeMfaType: activeMfaType.required(),
  emailVerified: Joi.boolean().required().default(false),
  phoneNumber: Joi.string().required(),
  phoneNumberVerified: Joi.boolean().required().default(false),
  roles: allowedRoles.required(),
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

// TODO non-specific 401 error: merge models instead
export const UnauthorizedErrorModel = Joi.object<ErrorPayload>({
  error: Joi.string().required(),
  status: Joi.valid(StatusCodes.UNAUTHORIZED).required(),
  message: Joi.string(),
}).meta({ className: 'UnauthorizedError' });

export const VersionModel = Joi.string()
  .example(process.env.npm_package_version)
  .meta({ className: 'Version' });
