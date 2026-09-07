package controller_test

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
)

func TestControllerVersion(t *testing.T) {
	t.Parallel()

	const version = "1.2.3"

	ctrl := controller.New("", "", "", nil, nil, nil, nil, nil, version)

	t.Run("gin handler", func(t *testing.T) {
		t.Parallel()

		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctrl.Version(ctx)

		var response controller.VersionResponse
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatalf("unmarshalling response: %v", err)
		}

		if response.BuildVersion != version {
			t.Errorf("BuildVersion = %q, want %q", response.BuildVersion, version)
		}
	})

	t.Run("OpenAPI handler", func(t *testing.T) {
		t.Parallel()

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
	})
}
