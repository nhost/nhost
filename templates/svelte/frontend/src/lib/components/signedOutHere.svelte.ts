/**
 * Set while a card is up that says this browser has been signed out, before any
 * load has told the layout so: a password change that could not sign this
 * device back in clears the session cookie, but the account page it happened on
 * is not loaded again, since the server hook would send a visitor without a
 * session off it. The nav reads this alongside the paths that look signed out.
 * Only the browser writes it, so a server render never sees it set.
 */
export const signedOutHere = $state({ current: false });
