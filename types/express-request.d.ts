import { PermissionVariables } from "@/types";
import winston from "winston";

interface RequestAuth {
  userId: string;
  defaultRole: string;
}

declare global {
  namespace Express {
    export interface Request {
      logger: winston.Logger;
      refreshToken?: string;
      auth: RequestAuth | null;
      permissionVariables?: PermissionVariables;
    }
  }
}
