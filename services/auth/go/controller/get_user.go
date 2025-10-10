package controller

import (
	"context"
	"encoding/json"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
	"github.com/oapi-codegen/runtime/types"
)

func (ctrl *Controller) GetUser( //nolint:ireturn
	ctx context.Context, _ api.GetUserRequestObject,
) (api.GetUserResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	// Get authenticated user from JWT
	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	// Get user roles
	userRoles, err := ctrl.wf.db.GetUserRoles(ctx, user.ID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user roles", logError(err))
		return nil, ErrInternalServerError
	}

	// Convert roles to string array
	roles := make([]string, len(userRoles))
	for i, role := range userRoles {
		roles[i] = role.Role
	}

	// Parse metadata from JSON bytes
	var metadata map[string]any
	if err := json.Unmarshal(user.Metadata, &metadata); err != nil {
		logger.ErrorContext(ctx, "error parsing user metadata", logError(err))

		metadata = map[string]any{}
	}

	// Convert user data to API User format (matching Node.js getUser response)
	userData := &api.User{
		Id:          user.ID.String(),
		CreatedAt:   user.CreatedAt.Time,
		DisplayName: user.DisplayName,
		AvatarUrl:   user.AvatarUrl,
		Locale:      user.Locale,
		Email: func() *types.Email {
			if user.Email.Valid {
				e := types.Email(user.Email.String)
				return &e
			}
			return nil
		}(),
		IsAnonymous:   user.IsAnonymous,
		DefaultRole:   user.DefaultRole,
		Metadata:      metadata,
		EmailVerified: user.EmailVerified,
		PhoneNumber: func() *string {
			if user.PhoneNumber.Valid {
				return &user.PhoneNumber.String
			}
			return nil
		}(),
		PhoneNumberVerified: user.PhoneNumberVerified,
		ActiveMfaType: func() *string {
			if user.ActiveMfaType.Valid {
				return &user.ActiveMfaType.String
			}
			return nil
		}(),
		Roles: roles,
	}

	return api.GetUser200JSONResponse(*userData), nil
}
