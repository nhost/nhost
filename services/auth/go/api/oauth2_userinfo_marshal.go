package api //nolint:revive,nolintlint

// MarshalJSON delegates to OAuth2UserinfoResponse.MarshalJSON so that
// AdditionalProperties (e.g. Hasura/GraphQL claims) are included in the
// JSON output. The generated type definition does not inherit methods from
// the base type, so without this the default marshaler would skip the
// json:"-" tagged AdditionalProperties field.
func (r Oauth2UserinfoGet200JSONResponse) MarshalJSON() ([]byte, error) {
	return OAuth2UserinfoResponse(r).MarshalJSON()
}

// MarshalJSON delegates to OAuth2UserinfoResponse.MarshalJSON.
func (r Oauth2UserinfoPost200JSONResponse) MarshalJSON() ([]byte, error) {
	return OAuth2UserinfoResponse(r).MarshalJSON()
}
