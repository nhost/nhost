package controller

import (
	"encoding/json"
	"net/http"

	"github.com/nhost/hasura-auth/go/api"
)

func isSensitive(err api.ErrorResponseError) bool {
	switch err {
	case
		api.EmailAlreadyInUse,
		api.RoleNotAllowed,
		api.SignupDisabled:
		return true
	case
		api.DefaultRoleMustBeInAllowedRoles,
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

type ErrorResponse api.ErrorResponse

func (response ErrorResponse) visit(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(response.Status)
	return json.NewEncoder(w).Encode(response) //nolint:wrapcheck
}

func (response ErrorResponse) VisitPostSignupEmailPasswordResponse(w http.ResponseWriter) error {
	return response.visit(w)
}

func (ctrl *Controller) sendError( //nolint:funlen,cyclop
	errType api.ErrorResponseError,
) ErrorResponse {
	invalidRequest := ErrorResponse{
		Status:  http.StatusBadRequest,
		Error:   api.InvalidRequest,
		Message: "invalid-request",
	}

	if ctrl.config.ConcealErrors && isSensitive(errType) {
		return invalidRequest
	}

	switch errType {
	case api.DefaultRoleMustBeInAllowedRoles:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   errType,
			Message: "Default role must be in allowed roles",
		}
	case api.EmailAlreadyInUse:
		return ErrorResponse{
			Status:  http.StatusConflict,
			Error:   errType,
			Message: "Email already in use",
		}
	case api.InternalServerError:
	case api.InvalidRequest:
	case api.LocaleNotAllowed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   errType,
			Message: "Locale not allowed",
		}
	case api.PasswordInHibpDatabase:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   errType,
			Message: "Password is in HIBP database",
		}
	case api.PasswordTooShort:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   errType,
			Message: "Password is too short",
		}
	case api.RedirecToNotAllowed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   errType,
			Message: "The value of \"options.redirectTo\" is not allowed.",
		}
	case api.RoleNotAllowed:
		return ErrorResponse{
			Status:  http.StatusBadRequest,
			Error:   errType,
			Message: "Role not allowed",
		}
	case api.SignupDisabled:
		return ErrorResponse{
			Status:  http.StatusForbidden,
			Error:   errType,
			Message: "Sign up is disabled.",
		}
	}

	return invalidRequest
}
