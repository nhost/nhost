package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

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
	ErrUserEmailNotFound               = &APIError{api.InvalidEmailPassword}
	ErrEmailAlreadyInUse               = &APIError{api.EmailAlreadyInUse}
	ErrInternalServerError             = &APIError{api.InternalServerError}
	ErrInvalidEmailPassword            = &APIError{api.InvalidEmailPassword}
	ErrPasswordTooShort                = &APIError{api.PasswordTooShort}
	ErrPasswordInHibpDatabase          = &APIError{api.PasswordInHibpDatabase}
	ErrRoleNotAllowed                  = &APIError{api.RoleNotAllowed}
	ErrDefaultRoleMustBeInAllowedRoles = &APIError{api.DefaultRoleMustBeInAllowedRoles}
	ErrRedirecToNotAllowed             = &APIError{api.RedirecToNotAllowed}
	ErrDisabledUser                    = &APIError{api.DisabledUser}
	ErrUnverifiedUser                  = &APIError{api.UnverifiedUser}
	ErrInvalidPat                      = &APIError{api.InvalidPat}
	ErrInvalidRequest                  = &APIError{api.InvalidRequest}
	ErrSignupDisabled                  = &APIError{api.SignupDisabled}
	ErrDisabledEndpoint                = &APIError{api.DisabledEndpoint}
	ErrEmailAlreadyVerified            = &APIError{api.EmailAlreadyVerified}
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

func (response ErrorResponse) VisitPostSignupEmailPasswordResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostSigninEmailPasswordResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostSigninPasswordlessEmailResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostSigninPatResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostUserEmailChangeResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostUserPasswordResetResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostUserEmailSendVerificationEmailResponse(
	w http.ResponseWriter,
) error {
	return response.visit(w)
}

func (response ErrorResponse) VisitPostPatResponse(w http.ResponseWriter) error {
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
		api.UnverifiedUser:
		return true
	case
		api.DefaultRoleMustBeInAllowedRoles,
		api.DisabledEndpoint,
		api.InternalServerError,
		api.InvalidRequest,
		api.LocaleNotAllowed,
		api.PasswordTooShort,
		api.PasswordInHibpDatabase,
		api.RedirecToNotAllowed:
		return false
	}
	return false
}

func (ctrl *Controller) sendError( //nolint:funlen,cyclop
	err *APIError,
) ErrorResponse {
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
	case api.RedirecToNotAllowed:
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
	}

	return invalidRequest
}

func (ctrl *Controller) respondWithError(err *APIError) ErrorResponse {
	return ctrl.sendError(err)
}
