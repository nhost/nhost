import winston from "winston";

interface RequestAuth {
  userId: string;
  defaultRole: string;
}

declare global {
  namespace Express {
    export interface Request {
      logger: winston.Logger;
      auth: RequestAuth | null;
      refreshToken?: string;
    }
  }
}
