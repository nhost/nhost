package webauthn

// TODO: move this to a _test.go file.
type defaultUser struct {
	id []byte
}

var _ User = (*defaultUser)(nil)

func (user *defaultUser) WebAuthnID() []byte {
	return user.id
}

func (user *defaultUser) WebAuthnName() string {
	return "newUser"
}

func (user *defaultUser) WebAuthnDisplayName() string {
	return "New User"
}

func (user *defaultUser) WebAuthnIcon() string {
	return "https://pics.com/avatar.png"
}

func (user *defaultUser) WebAuthnCredentials() []Credential {
	return []Credential{}
}
