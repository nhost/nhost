package secrets

import (
	"errors"
	"testing"
)

var errTestPromptClosed = errors.New("prompt closed")

func TestConfirmDelete(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		yes          bool
		interactive  bool
		confirmed    bool
		confirmErr   error
		wantProceed  bool
		wantErr      string
		wantPrompted bool
	}{
		{
			name:         "yes skips the prompt without a terminal",
			yes:          true,
			interactive:  false,
			confirmed:    false,
			confirmErr:   nil,
			wantProceed:  true,
			wantErr:      "",
			wantPrompted: false,
		},
		{
			name:         "yes skips the prompt in a terminal",
			yes:          true,
			interactive:  true,
			confirmed:    false,
			confirmErr:   nil,
			wantProceed:  true,
			wantErr:      "",
			wantPrompted: false,
		},
		{
			name:         "no terminal requires yes",
			yes:          false,
			interactive:  false,
			confirmed:    false,
			confirmErr:   nil,
			wantProceed:  false,
			wantErr:      "use --yes to skip confirmation",
			wantPrompted: false,
		},
		{
			name:         "confirmed in a terminal",
			yes:          false,
			interactive:  true,
			confirmed:    true,
			confirmErr:   nil,
			wantProceed:  true,
			wantErr:      "",
			wantPrompted: true,
		},
		{
			name:         "declined in a terminal",
			yes:          false,
			interactive:  true,
			confirmed:    false,
			confirmErr:   nil,
			wantProceed:  false,
			wantErr:      "",
			wantPrompted: true,
		},
		{
			name:         "closing the prompt cancels",
			yes:          false,
			interactive:  true,
			confirmed:    false,
			confirmErr:   errTestPromptClosed,
			wantProceed:  false,
			wantErr:      "",
			wantPrompted: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			prompted := ""
			confirm := func(message string) (bool, error) {
				prompted = message

				return tt.confirmed, tt.confirmErr
			}

			proceed, err := confirmDelete("MY_SECRET", tt.yes, tt.interactive, confirm)

			gotErr := ""
			if err != nil {
				gotErr = err.Error()
			}

			if gotErr != tt.wantErr {
				t.Errorf("error = %q, want %q", gotErr, tt.wantErr)
			}

			if proceed != tt.wantProceed {
				t.Errorf("proceed = %t, want %t", proceed, tt.wantProceed)
			}

			wantPrompt := ""
			if tt.wantPrompted {
				wantPrompt = "Delete secret MY_SECRET?"
			}

			if prompted != wantPrompt {
				t.Errorf("prompt = %q, want %q", prompted, wantPrompt)
			}
		})
	}
}
