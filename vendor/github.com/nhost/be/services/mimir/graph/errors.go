package graph

import (
	"errors"
)

var (
	ErrNameDuplicated                 = errors.New("name duplicated")
	ErrAppNotFound                    = errors.New("app not found")
	ErrAppAlreadyExists               = errors.New("app already exists")
	ErrSecretNotFound                 = errors.New("secret not found")
	ErrSecretAlreadyExists            = errors.New("secret already exists")
	ErrServiceNotFound                = errors.New("service not found")
	ErrServiceAlreadyExists           = errors.New("service already exists")
	ErrStorageCantBeDownsized         = errors.New("storage can't be downsized")
	ErrPersVolEncryptionCantBeChanged = errors.New(
		"persistent volumes encryption can't be changed while app is running",
	)
	ErrPersVolEncryptionCantBeDis = errors.New(
		"persistent volumes encryption can't be disabled",
	)
	ErrDatabaseVersionMismatch = errors.New(
		"version mismatch, you need to perform a database upgrade",
	)
	ErrDatabaseVersionMustBeGreater = errors.New(
		"new version must be greater than the current version",
	)
	ErrAppMustBeLive  = errors.New("app must be live")
	ErrPitrMinVersion = errors.New(
		"PiTR requires a postgres version with date greater or equal than 20250311",
	)
)

type VariableRequiredError struct {
	VariableName string
}

func NewVariableRequiredError(name string) error {
	return &VariableRequiredError{
		VariableName: name,
	}
}

func (e *VariableRequiredError) Error() string {
	return "variable required:" + e.VariableName
}
