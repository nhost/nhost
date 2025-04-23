package configserver

import (
	"context"

	"github.com/google/uuid"
)

type Querier struct{}

func (q Querier) GetAppDesiredState(_ context.Context, _ uuid.UUID) (int32, error) {
	return 0, nil
}
