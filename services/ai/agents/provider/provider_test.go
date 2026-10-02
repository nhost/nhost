package provider_test

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
)

func TestValidateModel(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		model   string
		wantErr error
	}{
		{
			name:    "valid",
			model:   "provider/model",
			wantErr: nil,
		},
		{
			name:    "empty",
			model:   "",
			wantErr: provider.ErrEmptyModel,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			err := provider.ValidateModel(test.model)
			if !errors.Is(err, test.wantErr) {
				t.Errorf("ValidateModel(%q) error = %v, want %v", test.model, err, test.wantErr)
			}
		})
	}
}
