import { AuthContext } from '../machines';
import { SessionActionHandlerResult } from '../promises';
import { NhostSession, SignUpResponse } from '../types';
export declare const getSession: (context?: AuthContext) => NhostSession | null;
export declare const getAuthenticationResult: ({ accessToken, refreshToken, isError, user, error }: SessionActionHandlerResult) => SignUpResponse;
//# sourceMappingURL=client-helpers.d.ts.map