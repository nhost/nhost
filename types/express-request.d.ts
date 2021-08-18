import PinoHttp from 'express-pino-logger';

interface RequestAuth {
  userId: string;
  defaultRole: string;
  isAnonymous: boolean;
}

declare global {
  namespace Express {
    export interface Request {
      log: PinoHttp.HttpLogger;
      auth: RequestAuth | null;
      refreshToken?: string;
    }
  }
}
