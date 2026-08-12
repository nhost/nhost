package config

import (
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/tui"
	"golang.org/x/term"
)

//nolint:gochecknoglobals // Test seam for Bubble Tea prompts.
var (
	runPrompt  = tui.RunPrompt
	runConfirm = tui.RunConfirm
	runPicker  = tui.RunPicker
)

func RunWizard() (*Config, error) {
	if !term.IsTerminal(int(os.Stdin.Fd())) || !term.IsTerminal(int(os.Stdout.Fd())) {
		return nil, ErrWizardRequiresTTY
	}

	cloud := wizardCloud()
	local := wizardLocal()
	projects := wizardProjects()

	if local != nil {
		projects = append([]Project{*local}, projects...)
	}

	return &Config{
		Cloud:    cloud,
		Projects: projects,
	}, nil
}

func wizardCloud() *Cloud {
	confirmed, err := runConfirm(
		"Enable Nhost Cloud access? (manage projects and organizations)",
	)
	if err != nil || !confirmed {
		return nil
	}

	return &Cloud{EnableMutations: true}
}

func wizardLocal() *Project {
	confirmed, err := runConfirm(
		"Enable local development access?",
	)
	if err != nil || !confirmed {
		return nil
	}

	secret, err := runPrompt(
		"Admin secret", clienv.DefaultLocalAdminSecret,
	)
	if err != nil {
		secret = clienv.DefaultLocalAdminSecret
	}

	return &Project{
		Subdomain:      "local",
		Region:         "local",
		Description:    "Local development project",
		AdminSecret:    &secret,
		PAT:            nil,
		ManageMetadata: true,
		AllowQueries:   []string{"*"},
		AllowMutations: []string{"*"},
		AuthURL:        "",
		GraphqlURL:     "",
		HasuraURL:      "",
	}
}

func wizardProjects() []Project {
	var projects []Project

	confirmed, err := runConfirm(
		"Configure access to a cloud project?",
	)
	if err != nil || !confirmed {
		return projects
	}

	for {
		p, err := wizardOneProject()
		if err != nil {
			break
		}

		projects = append(projects, *p)

		more, err := runConfirm("Add another project?")
		if err != nil || !more {
			break
		}
	}

	return projects
}

func wizardOneProject() (*Project, error) {
	subdomain, err := runPrompt("Project subdomain", "")
	if err != nil {
		return nil, err
	}

	if subdomain == "" {
		return nil, ErrPickerCancelled
	}

	region, err := runPrompt("Project region", "us-east-1")
	if err != nil {
		return nil, err
	}

	desc, err := runPrompt("Description (for LLM context)", "")
	if err != nil {
		return nil, err
	}

	metadata, err := runConfirm(
		"Allow managing metadata (tables, permissions)?",
	)
	if err != nil {
		return nil, err
	}

	authIdx, err := runPicker("Authentication method", []tui.PickerItem{
		{Label: "Admin Secret", Desc: "", Value: nil, Selected: false},
		{Label: "Personal Access Token", Desc: "", Value: nil, Selected: false},
	})
	if err != nil {
		return nil, err
	}

	project := &Project{
		Subdomain:      subdomain,
		Region:         region,
		Description:    desc,
		AdminSecret:    nil,
		PAT:            nil,
		ManageMetadata: metadata,
		AllowQueries:   []string{"*"},
		AllowMutations: []string{"*"},
		AuthURL:        "",
		GraphqlURL:     "",
		HasuraURL:      "",
	}

	if authIdx == 0 {
		if err := promptProjectAdminSecret(project); err != nil {
			return nil, err
		}
	} else if err := promptProjectPAT(project); err != nil {
		return nil, err
	}

	return project, nil
}

func promptProjectAdminSecret(project *Project) error {
	secret, err := runPrompt("Admin secret", "")
	if err != nil {
		return err
	}

	if secret == "" {
		return ErrEmptyCredential
	}

	project.AdminSecret = &secret

	return nil
}

func promptProjectPAT(project *Project) error {
	pat, err := runPrompt("Personal access token", "")
	if err != nil {
		return err
	}

	if pat == "" {
		return ErrEmptyCredential
	}

	project.PAT = &pat

	return nil
}
