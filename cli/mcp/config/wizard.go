package config

import (
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/tui"
	"golang.org/x/term"
)

func RunWizard() (*Config, error) {
	if !term.IsTerminal(int(os.Stdout.Fd())) {
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
	confirmed, err := tui.RunConfirm(
		"Enable Nhost Cloud access? (manage projects and organizations)",
	)
	if err != nil || !confirmed {
		return nil
	}

	return &Cloud{EnableMutations: true}
}

func wizardLocal() *Project {
	confirmed, err := tui.RunConfirm(
		"Enable local development access?",
	)
	if err != nil || !confirmed {
		return nil
	}

	secret, err := tui.RunPrompt(
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

	confirmed, err := tui.RunConfirm(
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

		more, err := tui.RunConfirm("Add another project?")
		if err != nil || !more {
			break
		}
	}

	return projects
}

func wizardOneProject() (*Project, error) {
	subdomain, err := tui.RunPrompt("Project subdomain", "")
	if err != nil || subdomain == "" {
		return nil, ErrPickerCancelled
	}

	region, err := tui.RunPrompt("Project region", "us-east-1")
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	desc, err := tui.RunPrompt("Description (for LLM context)", "")
	if err != nil {
		desc = ""
	}

	metadata, _ := tui.RunConfirm(
		"Allow managing metadata (tables, permissions)?",
	)

	authIdx, err := tui.RunPicker("Authentication method", []tui.PickerItem{
		{Label: "Admin Secret", Desc: "", Value: nil, Selected: false},
		{Label: "Personal Access Token", Desc: "", Value: nil, Selected: false},
	})

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

	if err != nil || authIdx == 0 {
		secret, _ := tui.RunPrompt("Admin secret", "")
		project.AdminSecret = &secret
	} else {
		pat, _ := tui.RunPrompt("Personal access token", "")
		project.PAT = &pat
	}

	return project, nil
}
