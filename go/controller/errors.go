package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/nhost/hasura-auth/go/api"
)

type APIError struct {
	t api.ErrorResponseError
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API error: %s", e.t)
}

var ErrElevatedClaimRequired = errors.New("elevated-claim-required")

var (
	ErrJWTConfiguration = errors.New("jwt-configuration")

	ErrAnonymousUsersDisabled          = &APIError{api.DisabledEndpoint}
	ErrUserEmailNotFound               = &APIError{api.InvalidEmailPassword}
	ErrUserPhoneNumberNotFound         = &APIError{api.InvalidRequest}
	ErrInvalidOTP                      = &APIError{api.InvalidRequest}
	ErrUserProviderNotFound            = &APIError{api.InvalidRequest}
	ErrSecurityKeyNotFound             = &APIError{api.InvalidRequest}
	ErrUserProviderAlreadyLinked       = &APIError{api.InvalidRequest}
	ErrEmailAlreadyInUse               = &APIError{api.EmailAlreadyInUse}
	ErrForbiddenAnonymous              = &APIError{api.ForbiddenAnonymous}
	ErrInternalServerError             = &APIError{api.InternalServerError}
	ErrInvalidEmailPassword            = &APIError{api.InvalidEmailPassword}
	ErrPasswordTooShort                = &APIError{api.PasswordTooShort}
	ErrPasswordInHibpDatabase          = &APIError{api.PasswordInHibpDatabase}
	ErrRoleNotAllowed                  = &APIError{api.RoleNotAllowed}
	ErrDefaultRoleMustBeInAllowedRoles = &APIError{api.DefaultRoleMustBeInAllowedRoles}
	ErrRedirecToNotAllowed             = &APIError{api.RedirectToNotAllowed}
	ErrDisabledUser                    = &APIError{api.DisabledUser}
	ErrUnverifiedUser                  = &APIError{api.UnverifiedUser}
	ErrUserNotAnonymous                = &APIError{api.UserNotAnonymous}
	ErrInvalidPat                      = &APIError{api.InvalidPat}
	ErrInvalidTicket                   = &APIError{api.InvalidTicket}
	ErrInvalidRequest                  = &APIError{api.InvalidRequest}
	ErrSignupDisabled                  = &APIError{api.SignupDisabled}
	ErrUnauthenticatedUser             = &APIError{api.InvalidRequest}
	ErrDisabledEndpoint                = &APIError{api.DisabledEndpoint}
	ErrEmailAlreadyVerified            = &APIError{api.EmailAlreadyVerified}
	ErrInvalidRefreshToken             = &APIError{api.InvalidRefreshToken}
	ErrDisabledMfaTotp                 = &APIError{api.DisabledMfaTotp}
	ErrNoTotpSecret                    = &APIError{api.NoTotpSecret}
	ErrInvalidTotp                     = &APIError{api.InvalidTotp}
	ErrMfaTypeNotFound                 = &APIError{api.MfaTypeNotFound}
	ErrTotpAlreadyActive               = &APIError{api.TotpAlreadyActive}
	ErrInvalidState                    = &APIError{api.InvalidState}
	ErrOauthTokenExchangeFailed        = &APIError{api.OauthTokenEchangeFailed}
	ErrOauthProfileFetchFailed         = &APIError{api.OauthProfileFetchFailed}
	ErrOauthProviderError              = &APIError{api.OauthProviderError}
	ErrCannotSendSMS                   = &APIError{api.CannotSendSms}
)

func logError(err error) slog.Attr {
	return slog.String("error", err.Error())
}

type ErrorResponse api.ErrorResponse

func (response ErrorResponse) visit(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(response.Status)
	return json.NewEncoder(w).Encode(response) //nolint:wrapcheck
}

func (response ErrorResponse) VisitSignUpEmailPasswordResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInAnonymousResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifySignInMfaTotpResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifyChangeUserMfaResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitChangeUserMfaResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInEmailPasswordResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInPasswordlessEmailResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInPATResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInProviderResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInProviderCallbackGetResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitChangeUserEmailResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitChangeUserPasswordResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSendPasswordResetEmailResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSendVerificationEmailResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitCreatePATResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitDeanonymizeUserResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignUpWebauthnResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInWebauthnResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifySignInWebauthnResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifySignUpWebauthnResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitRefreshTokenResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInIdTokenResponse( //nolint:revive,stylecheck
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitLinkIdTokenResponse( //nolint:revive,stylecheck
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifyTicketResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInOTPEmailResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifySignInOTPEmailResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitElevateWebauthnResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifyElevateWebauthnResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitAddSecurityKeyResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifyAddSecurityKeyResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignInPasswordlessSmsResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitSignOutResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifyTokenResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitGetUserResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitVerifySignInPasswordlessSmsResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func isSensitive(err api.ErrorResponseError) bool {
	switch err {
	case
		api.DisabledUser,
		api.EmailAlreadyInUse,
		api.EmailAlreadyVerified,
		api.ForbiddenAnonymous,
		api.InvalidEmailPassword,
		api.InvalidPat,
		api.RoleNotAllowed,
		api.SignupDisabled,
		api.UnverifiedUser,
		api.InvalidRefreshToken,
		api.InvalidTicket,
		api.DisabledMfaTotp,
		api.InvalidTotp,
		api.InvalidOtp,
		api.NoTotpSecret:
		return true
	case
		api.DefaultRoleMustBeInAllowedRoles,
		api.DisabledEndpoint,
		api.InternalServerError,
		api.InvalidRequest,
		api.LocaleNotAllowed,
		api.PasswordTooShort,
		api.PasswordInHibpDatabase,
		api.RedirectToNotAllowed,
		api.UserNotAnonymous,
		api.MfaTypeNotFound,
		api.TotpAlreadyActive,
		api.InvalidState,
		api.OauthTokenEchangeFailed,
		api.OauthProfileFetchFailed,
		api.CannotSendSms,
		api.OauthProviderError:
		return false
	}
	return false
}

func (ctrl *Controller) getError(err *APIError) ErrorResponse { //nolint:gocyclo,cyclop,funlen
	invalidRequest := ErrorResponse{
		Status:  http.StatusBadRequest,
		Error:   api.InvalidRequest,
		Message: "The request payload is incorrect",
	}

	if ctrl.config.ConcealErrors && isSensitive(err.t) {
		return invalidRequest
	}

	switch err.t {
	case api.DefaultRoleMustBeInAllowedRoles:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Default role must be in allowed roles",
		}
	case api.DisabledUser:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "User is disabled",
		}
	case api.DisabledEndpoint:
		return ErrorResponse{
			Status:  http.StatusConflict,
			Error:   err.t,
			Message: "This endpoint is disabled",
		}
	case api.EmailAlreadyInUse:
		return ErrorResponse{
			Status:  http.StatusConflict,
			Error:   err.t,
			Message: "Email already in use",
		}
	case api.EmailAlreadyVerified:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "User's email is already verified",
		}
	case api.ForbiddenAnonymous:
		return ErrorResponse{
			Status:  http.StatusForbidden,
			Error:   err.t,
			Message: "Forbidden, user is anonymous.",
		}
	case api.InternalServerError:
		return ErrorResponse{
			Status:  http.StatusInternalServerError,
			Error:   err.t,
			Message: "Internal server error",
		}
	case api.InvalidEmailPassword:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "Incorrect email or password",
		}
	case api.InvalidPat:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "Invalid or expired personal access token",
		}
	case api.InvalidRequest:
	case api.LocaleNotAllowed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Locale not allowed",
		}
	case api.PasswordInHibpDatabase:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Password is in HIBP database",
		}
	case api.PasswordTooShort:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Password is too short",
		}
	case api.RedirectToNotAllowed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "The value of \"options.redirectTo\" is not allowed.",
		}
	case api.RoleNotAllowed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Role not allowed",
		}
	case api.SignupDisabled:
		return ErrorResponse{
			Status:  http.StatusForbidden,
			Error:   err.t,
			Message: "Sign up is disabled.",
		}
	case api.UnverifiedUser:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "User is not verified.",
		}
	case api.UserNotAnonymous:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Logged in user is not anonymous",
		}
	case api.InvalidRefreshToken:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "Invalid or expired refresh token",
		}
	case api.InvalidTicket:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "Invalid ticket",
		}
	case api.DisabledMfaTotp:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "User does not have TOTP MFA enabled",
		}
	case api.NoTotpSecret:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "User does not have a TOTP secret",
		}
	case api.InvalidTotp:
		return ErrorResponse{
			Status:  http.StatusUnauthorized,
			Error:   err.t,
			Message: "Invalid TOTP code",
		}
	case api.MfaTypeNotFound:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "MFA type not found",
		}
	case api.TotpAlreadyActive:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "TOTP MFA is already active",
		}
	case api.InvalidState:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Invalid state",
		}
	case api.OauthTokenEchangeFailed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Failed to exchange token",
		}
	case api.OauthProfileFetchFailed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Failed to get user profile",
		}
	case api.OauthProviderError:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Provider returned an error",
		}
	case api.CannotSendSms:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Cannot send SMS, check your phone number is correct",
		}
	case api.InvalidOtp:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   err.t,
			Message: "Invalid or expired OTP",
		}
	}

	return invalidRequest
}

func (ctrl *Controller) sendError(
	err *APIError,
) ErrorResponse {
	return ctrl.getError(err)
}

type ErrorRedirectResponse struct {
	Headers struct {
		Location string
	}
}

func (response ErrorRedirectResponse) visit(w http.ResponseWriter) error {
	w.Header().Set("Location", response.Headers.Location)
	w.WriteHeader(http.StatusFound)
	return nil
}

func (response ErrorRedirectResponse) VisitVerifyTicketResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorRedirectResponse) VisitSignInProviderResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorRedirectResponse) VisitSignInProviderCallbackGetResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorRedirectResponse) VisitSignInProviderCallbackPostResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (ctrl *Controller) sendRedirectError(
	redirectURL *url.URL,
	err *APIError,
) ErrorRedirectResponse {
	errResponse := ctrl.getError(err)

	redirectURL = generateRedirectURL(redirectURL, map[string]string{
		"error":            string(errResponse.Error),
		"errorDescription": errResponse.Message,
	})

	return ErrorRedirectResponse{
		Headers: struct {
			Location string
		}{
			Location: redirectURL.String(),
		},
	}
}

func (ctrl *Controller) respondWithError(err *APIError) ErrorResponse {
	return ctrl.sendError(err)
}

func sqlErrIsDuplicatedEmail(err error, logger *slog.Logger) *APIError {
	if err == nil {
		return nil
	}

	if strings.Contains(err.Error(), "SQLSTATE 23505") &&
		strings.Contains(err.Error(), "\"users_email_key\"") {
		logger.Error("email already in use", logError(err))
		return ErrEmailAlreadyInUse
	}

	logger.Error("error inserting user", logError(err))
	return &APIError{api.InternalServerError}
}

func sqlIsDuplcateError(err error, fkey string) bool {
	if err == nil {
		return false
	}

	return strings.Contains(err.Error(), "SQLSTATE 23505") &&
		strings.Contains(err.Error(), fkey)
}

func generateRedirectURL(
	redirectTo *url.URL,
	opts map[string]string,
) *url.URL {
	q := redirectTo.Query()
	for k, v := range opts {
		q.Set(k, v)
	}
	redirectTo.RawQuery = q.Encode()

	return redirectTo
}
