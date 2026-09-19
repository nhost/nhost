// Shared by the client-side check (AvatarPicker.tsx) and the server action
// (app/profile/actions.ts) so the two caps cannot drift. Base64 in a JSON
// body grows the payload by a third, and the functions runtime rejects
// bodies over 6 MB, so the original photo is capped here; the request also
// has to clear next.config.ts's `serverActions.bodySizeLimit`, which is set
// to the same 4 MB. The avatar function shrinks the image far below this
// before storing it.
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
