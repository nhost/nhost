package webauthn

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"

	"github.com/go-webauthn/webauthn/protocol"
)

// BEGIN LOGIN
// These objects help us create the PublicKeyCredentialRequestOptions
// that will be passed to the authenticator via the user client.

// LoginOption is used to provide parameters that modify the default Credential Assertion Payload that is sent to the user.
type LoginOption func(*protocol.PublicKeyCredentialRequestOptions)

// DiscoverableUserHandler returns a *User given the provided userHandle.
type DiscoverableUserHandler func(rawID, userHandle []byte) (user User, err error)

// BeginLogin creates the *protocol.CredentialAssertion data payload that should be sent to the user agent for beginning
// the login/assertion process. The format of this data can be seen in §5.5 of the WebAuthn specification. These default
// values can be amended by providing additional LoginOption parameters. This function also returns sessionData, that
// must be stored by the RP in a secure manner and then provided to the FinishLogin function. This data helps us verify
// the ownership of the credential being retrieved.
//
// Specification: §5.5. Options for Assertion Generation (https://www.w3.org/TR/webauthn/#dictionary-assertion-options)
func (webauthn *WebAuthn) BeginLogin(user User, opts ...LoginOption) (*protocol.CredentialAssertion, *SessionData, error) {
	return webauthn.BeginMediatedLogin(user, "", opts...)
}

// BeginDiscoverableLogin begins a client-side discoverable login, previously known as Resident Key logins.
func (webauthn *WebAuthn) BeginDiscoverableLogin(opts ...LoginOption) (*protocol.CredentialAssertion, *SessionData, error) {
	return webauthn.beginLogin(nil, nil, "", opts...)
}

// BeginMediatedLogin is similar to BeginLogin however it also allows specifying a credential mediation requirement.
func (webauthn *WebAuthn) BeginMediatedLogin(user User, mediation protocol.CredentialMediationRequirement, opts ...LoginOption) (*protocol.CredentialAssertion, *SessionData, error) {
	credentials := user.WebAuthnCredentials()

	if len(credentials) == 0 { // If the user does not have any credentials, we cannot perform an assertion.
		return nil, nil, protocol.ErrBadRequest.WithDetails("Found no credentials for user")
	}

	var allowedCredentials = make([]protocol.CredentialDescriptor, len(credentials))

	for i, credential := range credentials {
		allowedCredentials[i] = credential.Descriptor()
	}

	return webauthn.beginLogin(user.WebAuthnID(), allowedCredentials, mediation, opts...)
}

// BeginDiscoverableMediatedLogin begins a client-side discoverable login with a mediation requirement, previously known
// as Resident Key logins.
func (webauthn *WebAuthn) BeginDiscoverableMediatedLogin(mediation protocol.CredentialMediationRequirement, opts ...LoginOption) (*protocol.CredentialAssertion, *SessionData, error) {
	return webauthn.beginLogin(nil, nil, mediation, opts...)
}

func (webauthn *WebAuthn) beginLogin(userID []byte, allowedCredentials []protocol.CredentialDescriptor, mediation protocol.CredentialMediationRequirement, opts ...LoginOption) (assertion *protocol.CredentialAssertion, session *SessionData, err error) {
	if err = webauthn.Config.validate(); err != nil {
		return nil, nil, fmt.Errorf(errFmtConfigValidate, err)
	}

	assertion = &protocol.CredentialAssertion{
		Response: protocol.PublicKeyCredentialRequestOptions{
			RelyingPartyID:     webauthn.Config.RPID,
			UserVerification:   webauthn.Config.AuthenticatorSelection.UserVerification,
			AllowedCredentials: allowedCredentials,
		},
		Mediation: mediation,
	}

	for _, opt := range opts {
		opt(&assertion.Response)
	}

	if len(assertion.Response.Challenge) == 0 {
		challenge, err := protocol.CreateChallenge()
		if err != nil {
			return nil, nil, err
		}
		assertion.Response.Challenge = challenge
	}

	if len(assertion.Response.Challenge) < 16 {
		return nil, nil, fmt.Errorf("error generating assertion: the challenge must be at least 16 bytes")
	}

	if len(assertion.Response.RelyingPartyID) == 0 {
		return nil, nil, fmt.Errorf("error generating assertion: the relying party id must be provided via the configuration or a functional option for a login")
	} else if _, err = url.Parse(assertion.Response.RelyingPartyID); err != nil {
		return nil, nil, fmt.Errorf("error generating assertion: the relying party id failed to validate as it's not a valid uri with error: %w", err)
	}

	if assertion.Response.Timeout == 0 {
		switch {
		case assertion.Response.UserVerification == protocol.VerificationDiscouraged:
			assertion.Response.Timeout = int(webauthn.Config.Timeouts.Login.TimeoutUVD.Milliseconds())
		default:
			assertion.Response.Timeout = int(webauthn.Config.Timeouts.Login.Timeout.Milliseconds())
		}
	}

	session = &SessionData{
		Challenge:            assertion.Response.Challenge.String(),
		RelyingPartyID:       assertion.Response.RelyingPartyID,
		UserID:               userID,
		AllowedCredentialIDs: assertion.Response.GetAllowedCredentialIDs(),
		UserVerification:     assertion.Response.UserVerification,
		Extensions:           assertion.Response.Extensions,
	}

	if webauthn.Config.Timeouts.Login.Enforce {
		session.Expires = time.Now().Add(time.Millisecond * time.Duration(assertion.Response.Timeout))
	}

	return assertion, session, nil
}

// WithAllowedCredentials adjusts the allowed credential list with Credential Descriptors, discussed in the included
// specification sections with user-supplied values.
//
// Specification: §5.10.3. Credential Descriptor (https://www.w3.org/TR/webauthn/#dictdef-publickeycredentialdescriptor)
//
// Specification: §5.4.4. Authenticator Selection Criteria (https://www.w3.org/TR/webauthn/#dom-authenticatorselectioncriteria-userverification)
func WithAllowedCredentials(allowList []protocol.CredentialDescriptor) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		cco.AllowedCredentials = allowList
	}
}

// WithUserVerification adjusts the user verification preference.
//
// Specification: §5.4.4. Authenticator Selection Criteria (https://www.w3.org/TR/webauthn/#dom-authenticatorselectioncriteria-userverification)
func WithUserVerification(userVerification protocol.UserVerificationRequirement) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		cco.UserVerification = userVerification
	}
}

// WithAssertionPublicKeyCredentialHints adjusts the non-default hints for credential types to select during login.
//
// WebAuthn Level 3.
func WithAssertionPublicKeyCredentialHints(hints []protocol.PublicKeyCredentialHints) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		cco.Hints = hints
	}
}

// WithAssertionExtensions adjusts the requested extensions.
func WithAssertionExtensions(extensions protocol.AuthenticationExtensions) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		cco.Extensions = extensions
	}
}

// WithAppIdExtension automatically includes the specified appid if the AllowedCredentials contains a credential
// with the type `fido-u2f`.
func WithAppIdExtension(appid string) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		for _, credential := range cco.AllowedCredentials {
			if credential.AttestationType == protocol.CredentialTypeFIDOU2F {
				if cco.Extensions == nil {
					cco.Extensions = map[string]any{}
				}

				cco.Extensions[protocol.ExtensionAppID] = appid
			}
		}
	}
}

// WithLoginRelyingPartyID sets the Relying Party ID for this particular login.
func WithLoginRelyingPartyID(id string) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		cco.RelyingPartyID = id
	}
}

// WithChallenge overrides the default random challenge with a user supplied value.
// In order to prevent replay attacks, the challenges MUST contain enough entropy to make guessing them infeasible.
// Challenges SHOULD therefore be at least 16 bytes long.
// This function is EXPERIMENTAL and can be removed without warning.
//
// Specification: §13.4.3. Cryptographic Challenges (https://www.w3.org/TR/webauthn/#sctn-cryptographic-challenges)
func WithChallenge(challenge []byte) LoginOption {
	return func(cco *protocol.PublicKeyCredentialRequestOptions) {
		cco.Challenge = challenge
	}
}

// FinishLogin takes the response from the client and validate it against the user credentials and stored session data.
func (webauthn *WebAuthn) FinishLogin(user User, session SessionData, response *http.Request) (*Credential, error) {
	parsedResponse, err := protocol.ParseCredentialRequestResponse(response)
	if err != nil {
		return nil, err
	}

	return webauthn.ValidateLogin(user, session, parsedResponse)
}

// FinishDiscoverableLogin takes the response from the client and validate it against the handler and stored session data.
// The handler helps to find out which user must be used to validate the response. This is a function defined in your
// business code that will retrieve the user from your persistent data.
func (webauthn *WebAuthn) FinishDiscoverableLogin(handler DiscoverableUserHandler, session SessionData, response *http.Request) (*Credential, error) {
	parsedResponse, err := protocol.ParseCredentialRequestResponse(response)
	if err != nil {
		return nil, err
	}

	return webauthn.ValidateDiscoverableLogin(handler, session, parsedResponse)
}

// ValidateLogin takes a parsed response and validates it against the user credentials and session data.
func (webauthn *WebAuthn) ValidateLogin(user User, session SessionData, parsedResponse *protocol.ParsedCredentialAssertionData) (*Credential, error) {
	if !bytes.Equal(user.WebAuthnID(), session.UserID) {
		return nil, protocol.ErrBadRequest.WithDetails("ID mismatch for User and Session")
	}

	if !session.Expires.IsZero() && session.Expires.Before(time.Now()) {
		return nil, protocol.ErrBadRequest.WithDetails("Session has Expired")
	}

	return webauthn.validateLogin(user, session, parsedResponse)
}

// ValidateDiscoverableLogin is an overloaded version of ValidateLogin that allows for discoverable credentials.
//
// Note: this is just a backwards compatibility layer over ValidatePasskeyLogin which returns more information.
func (webauthn *WebAuthn) ValidateDiscoverableLogin(handler DiscoverableUserHandler, session SessionData, parsedResponse *protocol.ParsedCredentialAssertionData) (credential *Credential, err error) {
	_, credential, err = webauthn.ValidatePasskeyLogin(handler, session, parsedResponse)

	return credential, err
}

// ValidatePasskeyLogin is an overloaded version of ValidateLogin that allows for passkey credentials.
func (webauthn *WebAuthn) ValidatePasskeyLogin(handler DiscoverableUserHandler, session SessionData, parsedResponse *protocol.ParsedCredentialAssertionData) (user User, credential *Credential, err error) {
	if len(session.UserID) != 0 {
		return nil, nil, protocol.ErrBadRequest.WithDetails("Session was not initiated as a client-side discoverable login")
	}

	if len(parsedResponse.Response.UserHandle) == 0 {
		return nil, nil, protocol.ErrBadRequest.WithDetails("Client-side Discoverable Assertion was attempted with a blank User Handle")
	}

	if user, err = handler(parsedResponse.RawID, parsedResponse.Response.UserHandle); err != nil {
		return nil, nil, protocol.ErrBadRequest.WithDetails(fmt.Sprintf("Failed to lookup Client-side Discoverable Credential: %s", err)).WithError(err)
	}

	if credential, err = webauthn.validateLogin(user, session, parsedResponse); err != nil {
		return nil, nil, err
	}

	return user, credential, nil
}

// ValidateLogin takes a parsed response and validates it against the user credentials and session data.
func (webauthn *WebAuthn) validateLogin(user User, session SessionData, parsedResponse *protocol.ParsedCredentialAssertionData) (*Credential, error) {
	// Step 1. If the allowCredentials option was given when this authentication ceremony was initiated,
	// verify that credential.id identifies one of the public key credentials that were listed in
	// allowCredentials.

	// NON-NORMATIVE Prior Step: Verify that the allowCredentials for the session are owned by the user provided.
	credentials := user.WebAuthnCredentials()

	var (
		found      bool
		credential Credential
	)

	if len(session.AllowedCredentialIDs) > 0 {
		var credentialsOwned bool

		for _, allowedCredentialID := range session.AllowedCredentialIDs {
			for _, credential = range credentials {
				if bytes.Equal(credential.ID, allowedCredentialID) {
					credentialsOwned = true

					break
				}

				credentialsOwned = false
			}
		}

		if !credentialsOwned {
			return nil, protocol.ErrBadRequest.WithDetails("User does not own all credentials from the allowedCredentialList")
		}

		for _, allowedCredentialID := range session.AllowedCredentialIDs {
			if bytes.Equal(parsedResponse.RawID, allowedCredentialID) {
				found = true

				break
			}
		}

		if !found {
			return nil, protocol.ErrBadRequest.WithDetails("User does not own the credential returned")
		}
	}

	// Step 2. If credential.response.userHandle is present, verify that the user identified by this value is
	// the owner of the public key credential identified by credential.id.

	// This is in part handled by our Step 1.

	userHandle := parsedResponse.Response.UserHandle
	if len(userHandle) > 0 {
		if !bytes.Equal(userHandle, user.WebAuthnID()) {
			return nil, protocol.ErrBadRequest.WithDetails("userHandle and User ID do not match")
		}
	}

	// Step 3. Using credential’s id attribute (or the corresponding rawId, if base64url encoding is inappropriate
	// for your use case), look up the corresponding credential public key.
	for _, credential = range credentials {
		if bytes.Equal(credential.ID, parsedResponse.RawID) {
			found = true

			break
		}

		found = false
	}

	if !found {
		return nil, protocol.ErrBadRequest.WithDetails("Unable to find the credential for the returned credential ID")
	}

	var (
		appID string
		err   error
	)

	// Ensure authenticators with a bad status is not used.
	if webauthn.Config.MDS != nil {
		var aaguid uuid.UUID

		if len(credential.Authenticator.AAGUID) == 0 {
			aaguid = uuid.Nil
		} else if aaguid, err = uuid.FromBytes(credential.Authenticator.AAGUID); err != nil {
			return nil, protocol.ErrBadRequest.WithDetails("Failed to decode AAGUID").WithInfo(fmt.Sprintf("Error occurred decoding AAGUID from the credential record: %s", err)).WithError(err)
		}

		var protoErr *protocol.Error

		if protoErr = protocol.ValidateMetadata(context.Background(), webauthn.Config.MDS, aaguid, "", nil); protoErr != nil {
			return nil, protocol.ErrBadRequest.WithDetails("Failed to validate credential record metadata").WithInfo(protoErr.DevInfo).WithError(protoErr)
		}
	}

	shouldVerifyUser := session.UserVerification == protocol.VerificationRequired

	rpID := webauthn.Config.RPID
	rpOrigins := webauthn.Config.RPOrigins
	rpTopOrigins := webauthn.Config.RPTopOrigins

	if appID, err = parsedResponse.GetAppID(session.Extensions, credential.AttestationType); err != nil {
		return nil, err
	}

	// Handle steps 4 through 16.
	if err = parsedResponse.Verify(session.Challenge, rpID, rpOrigins, rpTopOrigins, webauthn.Config.RPTopOriginVerificationMode, appID, shouldVerifyUser, credential.PublicKey); err != nil {
		return nil, err
	}

	// Handle step 17.
	credential.Authenticator.UpdateCounter(parsedResponse.Response.AuthenticatorData.Counter)
	// Check if the BackupEligible flag has changed.
	if credential.Flags.BackupEligible != parsedResponse.Response.AuthenticatorData.Flags.HasBackupEligible() {
		return nil, protocol.ErrBadRequest.WithDetails("BackupEligible flag inconsistency detected during login validation")
	}

	// Check for the invalid combination BE=0 and BS=1.
	if !parsedResponse.Response.AuthenticatorData.Flags.HasBackupEligible() && parsedResponse.Response.AuthenticatorData.Flags.HasBackupState() {
		return nil, protocol.ErrBadRequest.WithDetails("Invalid flag combination: BE=0 and BS=1")
	}

	// Update flags from response data.
	credential.Flags.UserPresent = parsedResponse.Response.AuthenticatorData.Flags.HasUserPresent()
	credential.Flags.UserVerified = parsedResponse.Response.AuthenticatorData.Flags.HasUserVerified()
	credential.Flags.BackupEligible = parsedResponse.Response.AuthenticatorData.Flags.HasBackupEligible()
	credential.Flags.BackupState = parsedResponse.Response.AuthenticatorData.Flags.HasBackupState()

	return &credential, nil
}
