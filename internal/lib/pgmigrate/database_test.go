package pgmigrate_test

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/internal/lib/pgmigrate/mock"
	"go.uber.org/mock/gomock"
)

func TestDatabaseBoundaryAndGeneratedMock(t *testing.T) {
	t.Parallel()

	var _ pgmigrate.Database = (*sql.DB)(nil)

	cause := sql.ErrConnDone
	database := mock.NewMockDatabase(gomock.NewController(t))
	database.EXPECT().Conn(gomock.Any()).Return(nil, cause)

	connection, err := database.Conn(t.Context())
	if connection != nil {
		t.Fatalf("Conn() connection = %v, want nil", connection)
	}

	if !errors.Is(err, cause) {
		t.Fatalf("Conn() error = %v, want %v", err, cause)
	}
}
