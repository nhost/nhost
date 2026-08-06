package config

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/cli/tui"
)

type promptCall struct {
	label        string
	defaultValue string
	value        string
	err          error
}

type confirmCall struct {
	message string
	value   bool
	err     error
}

type pickerCall struct {
	title string
	value int
	err   error
}

func stubWizardTUI(
	t *testing.T,
	prompts []promptCall,
	confirms []confirmCall,
	pickers []pickerCall,
) {
	t.Helper()

	originalPrompt := runPrompt
	originalConfirm := runConfirm
	originalPicker := runPicker

	promptIdx := 0
	confirmIdx := 0
	pickerIdx := 0

	runPrompt = func(label, defaultValue string) (string, error) {
		t.Helper()

		if promptIdx >= len(prompts) {
			t.Fatalf("unexpected prompt %q with default %q", label, defaultValue)

			return "", nil
		}

		call := prompts[promptIdx]
		promptIdx++

		if label != call.label {
			t.Fatalf("prompt label = %q, want %q", label, call.label)
		}

		if defaultValue != call.defaultValue {
			t.Fatalf("prompt default = %q, want %q", defaultValue, call.defaultValue)
		}

		return call.value, call.err
	}

	runConfirm = func(message string) (bool, error) {
		t.Helper()

		if confirmIdx >= len(confirms) {
			t.Fatalf("unexpected confirm %q", message)

			return false, nil
		}

		call := confirms[confirmIdx]
		confirmIdx++

		if message != call.message {
			t.Fatalf("confirm message = %q, want %q", message, call.message)
		}

		return call.value, call.err
	}

	runPicker = func(title string, _ []tui.PickerItem) (int, error) {
		t.Helper()

		if pickerIdx >= len(pickers) {
			t.Fatalf("unexpected picker %q", title)

			return -1, nil
		}

		call := pickers[pickerIdx]
		pickerIdx++

		if title != call.title {
			t.Fatalf("picker title = %q, want %q", title, call.title)
		}

		return call.value, call.err
	}

	t.Cleanup(func() {
		runPrompt = originalPrompt
		runConfirm = originalConfirm
		runPicker = originalPicker

		if promptIdx != len(prompts) {
			t.Errorf("used %d prompt responses, want %d", promptIdx, len(prompts))
		}

		if confirmIdx != len(confirms) {
			t.Errorf("used %d confirm responses, want %d", confirmIdx, len(confirms))
		}

		if pickerIdx != len(pickers) {
			t.Errorf("used %d picker responses, want %d", pickerIdx, len(pickers))
		}
	})
}

//nolint:paralleltest // Mutates package-level prompt seams.
func TestWizardOneProjectPropagatesCancellation(t *testing.T) {
	tests := []struct {
		name     string
		prompts  []promptCall
		confirms []confirmCall
		pickers  []pickerCall
		wantErr  error
	}{
		{
			name: "subdomain prompt",
			prompts: []promptCall{
				{
					label:        "Project subdomain",
					defaultValue: "",
					value:        "",
					err:          tui.ErrPromptCancelled,
				},
			},
			confirms: nil,
			pickers:  nil,
			wantErr:  tui.ErrPromptCancelled,
		},
		{
			name: "region prompt",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{
					label:        "Project region",
					defaultValue: "us-east-1",
					value:        "",
					err:          tui.ErrPromptCancelled,
				},
			},
			confirms: nil,
			pickers:  nil,
			wantErr:  tui.ErrPromptCancelled,
		},
		{
			name: "description prompt",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{
					label:        "Description (for LLM context)",
					defaultValue: "",
					value:        "",
					err:          tui.ErrPromptCancelled,
				},
			},
			confirms: nil,
			pickers:  nil,
			wantErr:  tui.ErrPromptCancelled,
		},
		{
			name: "metadata confirm",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{label: "Description (for LLM context)", defaultValue: "", value: "desc", err: nil},
			},
			confirms: []confirmCall{
				{
					message: "Allow managing metadata (tables, permissions)?",
					value:   false,
					err:     tui.ErrConfirmCancelled,
				},
			},
			pickers: nil,
			wantErr: tui.ErrConfirmCancelled,
		},
		{
			name: "auth picker",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{label: "Description (for LLM context)", defaultValue: "", value: "desc", err: nil},
			},
			confirms: []confirmCall{
				{message: "Allow managing metadata (tables, permissions)?", value: true, err: nil},
			},
			pickers: []pickerCall{
				{title: "Authentication method", value: -1, err: tui.ErrPickerCancelled},
			},
			wantErr: tui.ErrPickerCancelled,
		},
		{
			name: "admin credential prompt",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{label: "Description (for LLM context)", defaultValue: "", value: "desc", err: nil},
				{label: "Admin secret", defaultValue: "", value: "", err: tui.ErrPromptCancelled},
			},
			confirms: []confirmCall{
				{message: "Allow managing metadata (tables, permissions)?", value: true, err: nil},
			},
			pickers: []pickerCall{
				{title: "Authentication method", value: 0, err: nil},
			},
			wantErr: tui.ErrPromptCancelled,
		},
		{
			name: "pat credential prompt",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{label: "Description (for LLM context)", defaultValue: "", value: "desc", err: nil},
				{
					label:        "Personal access token",
					defaultValue: "",
					value:        "",
					err:          tui.ErrPromptCancelled,
				},
			},
			confirms: []confirmCall{
				{message: "Allow managing metadata (tables, permissions)?", value: true, err: nil},
			},
			pickers: []pickerCall{
				{title: "Authentication method", value: 1, err: nil},
			},
			wantErr: tui.ErrPromptCancelled,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stubWizardTUI(t, tt.prompts, tt.confirms, tt.pickers)

			project, err := wizardOneProject()
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("wizardOneProject() error = %v, want %v", err, tt.wantErr)
			}

			assertNoEmptyCredentialProject(t, project)
		})
	}
}

//nolint:paralleltest // Mutates package-level prompt seams.
func TestWizardOneProjectRejectsEmptyCredential(t *testing.T) {
	tests := []struct {
		name     string
		prompts  []promptCall
		confirms []confirmCall
		pickers  []pickerCall
	}{
		{
			name: "admin secret",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{label: "Description (for LLM context)", defaultValue: "", value: "desc", err: nil},
				{label: "Admin secret", defaultValue: "", value: "", err: nil},
			},
			confirms: []confirmCall{
				{message: "Allow managing metadata (tables, permissions)?", value: true, err: nil},
			},
			pickers: []pickerCall{
				{title: "Authentication method", value: 0, err: nil},
			},
		},
		{
			name: "personal access token",
			prompts: []promptCall{
				{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
				{label: "Project region", defaultValue: "us-east-1", value: "us-east-1", err: nil},
				{label: "Description (for LLM context)", defaultValue: "", value: "desc", err: nil},
				{label: "Personal access token", defaultValue: "", value: "", err: nil},
			},
			confirms: []confirmCall{
				{message: "Allow managing metadata (tables, permissions)?", value: true, err: nil},
			},
			pickers: []pickerCall{
				{title: "Authentication method", value: 1, err: nil},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stubWizardTUI(t, tt.prompts, tt.confirms, tt.pickers)

			project, err := wizardOneProject()
			if !errors.Is(err, ErrEmptyCredential) {
				t.Fatalf("wizardOneProject() error = %v, want %v", err, ErrEmptyCredential)
			}

			assertNoEmptyCredentialProject(t, project)
		})
	}
}

//nolint:paralleltest // Mutates package-level prompt seams.
func TestWizardOneProjectCredentialHappyPaths(t *testing.T) {
	tests := []struct {
		name            string
		authIdx         int
		credentialLabel string
		credential      string
		wantAdminSecret bool
	}{
		{
			name:            "admin secret",
			authIdx:         0,
			credentialLabel: "Admin secret",
			credential:      "secret",
			wantAdminSecret: true,
		},
		{
			name:            "personal access token",
			authIdx:         1,
			credentialLabel: "Personal access token",
			credential:      "pat",
			wantAdminSecret: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stubWizardTUI(
				t,
				[]promptCall{
					{label: "Project subdomain", defaultValue: "", value: "app", err: nil},
					{
						label:        "Project region",
						defaultValue: "us-east-1",
						value:        "eu-central-1",
						err:          nil,
					},
					{
						label:        "Description (for LLM context)",
						defaultValue: "",
						value:        "desc",
						err:          nil,
					},
					{label: tt.credentialLabel, defaultValue: "", value: tt.credential, err: nil},
				},
				[]confirmCall{
					{
						message: "Allow managing metadata (tables, permissions)?",
						value:   true,
						err:     nil,
					},
				},
				[]pickerCall{
					{title: "Authentication method", value: tt.authIdx, err: nil},
				},
			)

			project, err := wizardOneProject()
			if err != nil {
				t.Fatalf("wizardOneProject() error = %v", err)
			}

			assertHappyProjectBase(t, project)

			if tt.wantAdminSecret {
				assertProjectAdminCredential(t, project, tt.credential)

				return
			}

			assertProjectPATCredential(t, project, tt.credential)
		})
	}
}

//nolint:paralleltest // Mutates package-level prompt seams.
func TestWizardProjectsDoesNotAppendWhenProjectErrors(t *testing.T) {
	stubWizardTUI(
		t,
		[]promptCall{
			{label: "Project subdomain", defaultValue: "", value: "", err: tui.ErrPromptCancelled},
		},
		[]confirmCall{
			{message: "Configure access to a cloud project?", value: true, err: nil},
		},
		nil,
	)

	projects := wizardProjects()
	if len(projects) != 0 {
		t.Fatalf("wizardProjects() returned %d projects, want 0", len(projects))
	}
}

func TestRunWizardRequiresTTY(t *testing.T) {
	t.Parallel()

	cfg, err := RunWizard()
	if !errors.Is(err, ErrWizardRequiresTTY) {
		t.Fatalf("RunWizard() error = %v, want %v", err, ErrWizardRequiresTTY)
	}

	if cfg != nil {
		t.Fatalf("RunWizard() config = %v, want nil", cfg)
	}
}

func assertHappyProjectBase(t *testing.T, project *Project) {
	t.Helper()

	if project == nil {
		t.Fatal("wizardOneProject() project is nil")
	}

	if project.Subdomain != "app" {
		t.Errorf("Subdomain = %q, want app", project.Subdomain)
	}

	if project.Region != "eu-central-1" {
		t.Errorf("Region = %q, want eu-central-1", project.Region)
	}

	if project.Description != "desc" {
		t.Errorf("Description = %q, want desc", project.Description)
	}

	if !project.ManageMetadata {
		t.Error("ManageMetadata = false, want true")
	}
}

func assertProjectAdminCredential(t *testing.T, project *Project, credential string) {
	t.Helper()

	if project.AdminSecret == nil || *project.AdminSecret != credential {
		t.Fatalf("AdminSecret = %v, want %q", project.AdminSecret, credential)
	}

	if project.PAT != nil {
		t.Fatalf("PAT = %v, want nil", project.PAT)
	}
}

func assertProjectPATCredential(t *testing.T, project *Project, credential string) {
	t.Helper()

	if project.PAT == nil || *project.PAT != credential {
		t.Fatalf("PAT = %v, want %q", project.PAT, credential)
	}

	if project.AdminSecret != nil {
		t.Fatalf("AdminSecret = %v, want nil", project.AdminSecret)
	}
}

func assertNoEmptyCredentialProject(t *testing.T, project *Project) {
	t.Helper()

	if project == nil {
		return
	}

	if project.AdminSecret != nil && *project.AdminSecret == "" {
		t.Fatal("AdminSecret is a pointer to an empty string")
	}

	if project.PAT != nil && *project.PAT == "" {
		t.Fatal("PAT is a pointer to an empty string")
	}
}
