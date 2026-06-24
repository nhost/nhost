package controller

import (
	"context"
	"testing"

	"github.com/nhost/nhost/services/constellation/api"
)

func TestControllerGetVersion(t *testing.T) {
	t.Parallel()

	c := &Controller{version: "1.2.3"}

	resp, err := c.GetVersion(context.Background(), api.GetVersionRequestObject{})
	if err != nil {
		t.Fatalf("GetVersion error: %v", err)
	}

	got, ok := resp.(api.GetVersion200JSONResponse)
	if !ok {
		t.Fatalf("GetVersion returned %T; want api.GetVersion200JSONResponse", resp)
	}

	if got.Version != "1.2.3" {
		t.Errorf("Version = %q; want %q", got.Version, "1.2.3")
	}
}

func TestControllerHealthz(t *testing.T) {
	t.Parallel()

	c := &Controller{version: "x"}

	resp, err := c.HealthzGet(context.Background(), api.HealthzGetRequestObject{})
	if err != nil {
		t.Fatalf("HealthzGet error: %v", err)
	}

	if got, ok := resp.(api.HealthzGet200TextResponse); !ok || string(got) != "ok" {
		t.Errorf("HealthzGet = %#v; want api.HealthzGet200TextResponse(\"ok\")", resp)
	}
}
