package api //nolint:revive,nolintlint

// Identifiers for the built-in providers supporting id-token sign-in. Apple
// and Google are the built-in values accepted at the HTTP layer (whose
// pattern also admits c:<slug> custom provider ids); fake is only used by
// unit tests that bypass HTTP validation.
const (
	IdTokenProviderApple  = IdTokenProvider("apple")  //nolint:revive
	IdTokenProviderGoogle = IdTokenProvider("google") //nolint:revive
	IdTokenProviderFake   = IdTokenProvider("fake")   //nolint:revive
)
