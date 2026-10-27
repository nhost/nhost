// A cookie JavaScript can read that says a session cookie is there, written
// and deleted alongside it by `sessionCookies` in `server.ts`. It carries no
// token, only the fact: the session itself stays httpOnly.
export const SIGNED_IN_KEY = 'nhostSignedIn';

export function isSignedIn(cookieString: string): boolean {
  return cookieString
    .split(';')
    .some((part) => part.trim().startsWith(`${SIGNED_IN_KEY}=`));
}
