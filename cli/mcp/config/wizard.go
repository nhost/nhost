package config

import (
	"fmt"

	"github.com/charmbracelet/huh"
)

const defaultAdminSecret = "nhost-admin-secret" //nolint:gosec

func RunWizard() (*Config, error) {
	cloudConfig, err := wizardCloud()
	if err != nil {
		return nil, fmt.Errorf("cloud configuration: %w", err)
	}

	localConfig, err := wizardLocal()
	if err != nil {
		return nil, fmt.Errorf("local configuration: %w", err)
	}

	projects, err := wizardProject()
	if err != nil {
		return nil, fmt.Errorf("project configuration: %w", err)
	}

	if localConfig != nil {
		projects = append([]Project{*localConfig}, projects...)
	}

	return &Config{
		Cloud:    cloudConfig,
		Projects: projects,
	}, nil
}

func wizardCloud() (*Cloud, error) {
	var enableCloud bool

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Enable Nhost Cloud access?").
				Description(
					"This allows LLMs to manage your Nhost projects and organizations.\n" +
						"You can view and configure projects as you would in the dashboard.",
				).
				Value(&enableCloud).
				Affirmative("Yes").
				Negative("No"),
		),
	)

	if err := form.Run(); err != nil {
		return nil, fmt.Errorf("cloud access form: %w", err)
	}

	if !enableCloud {
		return nil, nil //nolint:nilnil
	}

	return &Cloud{
		EnableMutations: true,
	}, nil
}

func wizardLocal() (*Project, error) {
	var enableLocal bool

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Enable local development access?").
				Description(
					"This allows LLMs to interact with your local Nhost environment,\n" +
						"including project configuration and GraphQL API access.\n" +
						"This gives LLMs context to generate code to interact with your Nhost project.",
				).
				Value(&enableLocal).
				Affirmative("Yes").
				Negative("No"),
		),
	)

	if err := form.Run(); err != nil {
		return nil, fmt.Errorf("local access form: %w", err)
	}

	if !enableLocal {
		return nil, nil //nolint:nilnil
	}

	adminSecret := defaultAdminSecret

	secretForm := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Admin Secret").
				Description("Leave empty for default: nhost-admin-secret").
				Value(&adminSecret),
		),
	)

	if err := secretForm.Run(); err != nil {
		return nil, fmt.Errorf("admin secret form: %w", err)
	}

	if adminSecret == "" {
		adminSecret = defaultAdminSecret
	}

	return &Project{
		Subdomain:      "local",
		Region:         "local",
		Description:    "Local development project running via the Nhost CLI",
		AdminSecret:    &adminSecret,
		PAT:            nil,
		ManageMetadata: true,
		AllowQueries:   []string{"*"},
		AllowMutations: []string{"*"},
		AuthURL:        "",
		GraphqlURL:     "",
		HasuraURL:      "",
	}, nil
}

func wizardProject() ([]Project, error) {
	var enableProjects bool

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Configure project-specific access?").
				Description(
					"Configure LLM access to your projects' GraphQL APIs.\n" +
						"This allows using agents to query and analyze your data and even to add new data.\n" +
						"You can control which queries and mutations are allowed per project.",
				).
				Value(&enableProjects).
				Affirmative("Yes").
				Negative("No"),
		),
	)

	if err := form.Run(); err != nil {
		return nil, fmt.Errorf("project access form: %w", err)
	}

	if !enableProjects {
		return nil, nil
	}

	projects := make([]Project, 0)

	for {
		project, err := wizardSingleProject()
		if err != nil {
			return nil, err
		}

		projects = append(projects, *project)

		var addAnother bool

		anotherForm := huh.NewForm(
			huh.NewGroup(
				huh.NewConfirm().
					Title("Add another project?").
					Value(&addAnother).
					Affirmative("Yes").
					Negative("No"),
			),
		)

		if err := anotherForm.Run(); err != nil {
			return nil, fmt.Errorf("add another project form: %w", err)
		}

		if !addAnother {
			break
		}
	}

	return projects, nil
}

func wizardSingleProject() (*Project, error) {
	project, authType, err := wizardProjectDetails()
	if err != nil {
		return nil, err
	}

	if err := wizardProjectAuth(project, authType); err != nil {
		return nil, err
	}

	return project, nil
}

func wizardProjectDetails() (*Project, string, error) {
	var (
		subdomain      string
		region         string
		description    string
		manageMetadata bool
		authType       string
	)

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Project subdomain").
				Value(&subdomain),
			huh.NewInput().
				Title("Project region").
				Value(&region),
			huh.NewInput().
				Title("Project description").
				Description("Provide additional information to LLMs").
				Value(&description),
			huh.NewConfirm().
				Title("Allow managing metadata?").
				Description("Tables, relationships, permissions, etc").
				Value(&manageMetadata).
				Affirmative("Yes").
				Negative("No"),
			huh.NewSelect[string]().
				Title("Authentication method").
				Options(
					huh.NewOption("Admin Secret", "admin_secret"),
					huh.NewOption("PAT", "pat"),
				).
				Value(&authType),
		),
	)

	if err := form.Run(); err != nil {
		return nil, "", fmt.Errorf("project details form: %w", err)
	}

	project := &Project{
		Subdomain:      subdomain,
		Region:         region,
		Description:    description,
		AdminSecret:    nil,
		PAT:            nil,
		ManageMetadata: manageMetadata,
		AllowQueries:   []string{"*"},
		AllowMutations: []string{"*"},
		GraphqlURL:     "",
		AuthURL:        "",
		HasuraURL:      "",
	}

	return project, authType, nil
}

func wizardProjectAuth(project *Project, authType string) error {
	var secret string

	title := "Admin Secret"
	if authType != "admin_secret" {
		title = "PAT"
	}

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title(title).
				EchoMode(huh.EchoModePassword).
				Value(&secret),
		),
	)

	if err := form.Run(); err != nil {
		return fmt.Errorf("project auth form: %w", err)
	}

	if authType == "admin_secret" {
		project.AdminSecret = &secret
	} else {
		project.PAT = &secret
	}

	return nil
}
