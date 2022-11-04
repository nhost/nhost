import type { HasuraUserClaims } from './hasura'

// to make the file a module and avoid the TypeScript error
export { }

declare global {
  namespace Express {
    export interface Request {
    //   language?: Language;
      userClaims?: HasuraUserClaims
      isAdmin: boolean
      role: string
    }
  }
}