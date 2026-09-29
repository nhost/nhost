package session

import "context"

type (
	userIDContextKey      struct{}
	accessTokenContextKey struct{}
)

// WithUserID returns a copy of ctx that selects the stored session of userID
// for every SDK request made with it. It is how a server that keeps the
// sessions of many users in one [Backend] says which user a request is for.
//
// userID must come from something the caller has already verified, such as its
// own authenticated cookie session. Never take it from an access token a client
// sent: its claims are not verified by the SDK, so a forged token could select
// another user's stored session.
//
// Without a user ID, a request uses the only session of a single-session
// backend ([MemoryStorage], [FileStorage]) and no session of a multi-user one
// ([MultiUserMemoryStorage]).
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDContextKey{}, userID)
}

// UserIDFromContext returns the user ID set by [WithUserID], or "" if none is.
func UserIDFromContext(ctx context.Context) string {
	userID, _ := ctx.Value(userIDContextKey{}).(string)

	return userID
}

// WithAccessToken returns a copy of ctx whose SDK requests authenticate with
// accessToken instead of a stored session. It is for a server acting on behalf
// of a caller that sent its own token: the token is attached as-is, is never
// stored or refreshed, and does not touch the client's session storage.
func WithAccessToken(ctx context.Context, accessToken string) context.Context {
	return context.WithValue(ctx, accessTokenContextKey{}, accessToken)
}

// AccessTokenFromContext returns the access token set by [WithAccessToken] and
// whether a non-empty one is set.
func AccessTokenFromContext(ctx context.Context) (string, bool) {
	accessToken, _ := ctx.Value(accessTokenContextKey{}).(string)

	return accessToken, accessToken != ""
}
