package clienv

import (
	"fmt"

	"github.com/charmbracelet/huh"
)

const (
	loginMethodPAT           = "pat"
	loginMethodEmailPassword = "email"
	loginMethodGithub        = "github"
)

type loginResult struct {
	method   string
	pat      string
	email    string
	password string
}

func (ce *CliEnv) loginMethodInteractive() (*loginResult, error) {
	method, err := ce.promptLoginMethod()
	if err != nil {
		return nil, err
	}

	result := &loginResult{
		method:   method,
		pat:      "",
		email:    "",
		password: "",
	}

	switch method {
	case loginMethodPAT:
		result.pat, err = ce.promptPAT()
	case loginMethodEmailPassword:
		result.email, result.password, err = ce.promptEmailPassword()
	case loginMethodGithub:
		// No additional input needed
	}

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (ce *CliEnv) promptLoginMethod() (string, error) {
	var method string

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[string]().
				Title("Select authentication method").
				Options(
					huh.NewOption("Personal Access Token (PAT)", loginMethodPAT),
					huh.NewOption("Email / Password", loginMethodEmailPassword),
					huh.NewOption("GitHub", loginMethodGithub),
				).
				Value(&method),
		),
	)

	if err := ce.RunForm(form); err != nil {
		return "", fmt.Errorf("failed to select authentication method: %w", err)
	}

	return method, nil
}

func (ce *CliEnv) promptPAT() (string, error) {
	var pat string

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Personal Access Token").
				EchoMode(huh.EchoModePassword).
				Value(&pat),
		),
	)

	if err := ce.RunForm(form); err != nil {
		return "", fmt.Errorf("failed to read PAT: %w", err)
	}

	return pat, nil
}

func (ce *CliEnv) promptEmailPassword() (string, string, error) {
	var email, password string

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Email").
				Value(&email),
			huh.NewInput().
				Title("Password").
				EchoMode(huh.EchoModePassword).
				Value(&password),
		),
	)

	if err := ce.RunForm(form); err != nil {
		return "", "", fmt.Errorf("failed to read credentials: %w", err)
	}

	return email, password, nil
}
