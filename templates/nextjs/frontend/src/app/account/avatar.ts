// Where an uploaded avatar is served from. The file itself is private in
// storage and read with the session token by the route handler at this path,
// so `avatar_url` on the account points here rather than at storage.
const PREFIX = '/api/avatar/';

export const avatarUrlFor = (fileId: string): string => `${PREFIX}${fileId}`;

// The file id behind an avatar URL this app wrote, or undefined for anything
// else, such as the gravatar URL a fresh account starts with.
export const avatarFileIdFrom = (
  url: string | undefined,
): string | undefined =>
  url?.startsWith(PREFIX) ? url.slice(PREFIX.length) : undefined;
