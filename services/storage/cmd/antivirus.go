package cmd

import (
	"context"
	"errors"
	"io"

	"github.com/nhost/nhost/services/storage/clamd"
	"github.com/nhost/nhost/services/storage/controller"
)

type DummyAntivirus struct{}

func (d *DummyAntivirus) ScanReader(_ context.Context, _ io.ReaderAt) *controller.APIError {
	return nil
}

type ClamavWrapper struct {
	clamav *clamd.Client
}

func (c *ClamavWrapper) ScanReader(ctx context.Context, r io.ReaderAt) *controller.APIError {
	err := c.clamav.InStream(ctx, r)

	virusFoundErr := &clamd.VirusFoundError{} //nolint:exhaustruct
	switch {
	case errors.As(err, &virusFoundErr):
		err := controller.ForbiddenError(
			err,
			err.Error(),
		)
		err.SetData("virus", virusFoundErr.Name)

		return err
	case err != nil:
		return controller.InternalServerError(err)
	}

	return nil
}

func getAv(addr string) (controller.Antivirus, error) { //nolint:ireturn
	if addr == "" {
		return &DummyAntivirus{}, nil
	}

	c, err := clamd.NewClient(addr)
	if err != nil {
		return nil, controller.InternalServerError(err)
	}

	return &ClamavWrapper{clamav: c}, nil
}
