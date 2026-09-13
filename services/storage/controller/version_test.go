package controller_test

import (
	"context"
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
)

func TestControllerGetVersion(t *testing.T) {
	t.Parallel()

	const version = "1.2.3"

	ctrl := controller.New("", "", "", nil, nil, nil, nil, nil, version)

	response, err := ctrl.GetVersion(context.Background(), api.GetVersionRequestObject{})
	if err != nil {
		t.Fatalf("GetVersion() error = %v", err)
	}

	got, ok := response.(api.GetVersion200JSONResponse)
	if !ok {
		t.Fatalf(
			"GetVersion() response type = %T, want api.GetVersion200JSONResponse",
			response,
		)
	}

	if got.BuildVersion != version {
		t.Errorf("BuildVersion = %q, want %q", got.BuildVersion, version)
	}
}
