import { PermissionVariables } from '@/types';
import winston from 'winston';

declare global {
  namespace Express {
    export interface Request {
      logger: winston.Logger
      refreshToken?: string
      permissionVariables?: PermissionVariables
    }
  }
}
