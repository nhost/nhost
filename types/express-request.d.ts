interface RequestAuth {
  userId: string;
  defaultRole: string;
  isAnonymous: boolean;
}

declare namespace Express {
  export interface Request {
    auth: RequestAuth | null;
    refreshToken?: string;
  }
}
