import { PermissionVariables } from '@/types';
import winston from 'winston';

declare global {
  namespace Express {
    export interface Request {
      logger: winston.Logger
      refresh_token?: string
      permission_variables?: PermissionVariables
    }
  }
}
