package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

//nolint:forbidigo
func RunWizard() (*Config, error) {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("Welcome to the Nhost MCP Configuration Wizard!")
	fmt.Println("==============================================")
	fmt.Println()

	cloudConfig := wizardCloud(reader)

	fmt.Println()

	localConfig := wizardLocal(reader)

	fmt.Println()

	projects := wizardProject(reader)

	fmt.Println()

	return &Config{
		Cloud:    cloudConfig,
		Local:    localConfig,
		Projects: projects,
	}, nil
}

//nolint:forbidigo
func wizardCloud(reader *bufio.Reader) *Cloud {
	fmt.Println("1. Nhost Cloud Access")
	fmt.Println("   This allows LLMs to manage your Nhost projects and organizations.")
	fmt.Println("   You can view and configure projects as you would in the dashboard.")

	if promptYesNo(reader, "Enable Nhost Cloud access?") {
		pat := promptString(
			reader,
			"Enter Personal Access Token (from https://app.nhost.io/account):",
		)

		return &Cloud{
			PAT:             pat,
			EnableMutations: true,
		}
	}

	return nil
}

//nolint:forbidigo
func wizardLocal(reader *bufio.Reader) *Local {
	fmt.Println("2. Local Development Access")
	fmt.Println("   This allows LLMs to interact with your local Nhost environment,")
	fmt.Println("   including project configuration and GraphQL API access.")
	fmt.Println("   This gives LLMs context to generate code to interact with your Nhost project.")

	if promptYesNo(reader, "Enable local development access?") {
		adminSecret := promptString(reader, "Enter Admin Secret (default: nhost-admin-secret):")
		if adminSecret == "" {
			adminSecret = "nhost-admin-secret" //nolint:gosec
		}

		return &Local{
			AdminSecret:     adminSecret,
			ConfigServerURL: nil,
			GraphqlURL:      nil,
		}
	}

	return nil
}

//nolint:forbidigo
func wizardProject(reader *bufio.Reader) []Project {
	projects := make([]Project, 0)

	fmt.Println("3. Project-Specific Access")
	fmt.Println("   Configure LLM access to your projects' GraphQL APIs.")
	fmt.Println(
		"   This allows using agents to query and analyze your data and even to add new data",
	)
	fmt.Println(
		"   You can control which queries and mutations are allowed per project. See the docs",
	)
	fmt.Println("   for more details on how to configure this.")

	if promptYesNo(reader, "Configure project access?") {
		for {
			project := Project{
				Subdomain:      "",
				Region:         "",
				AdminSecret:    nil,
				PAT:            nil,
				AllowQueries:   []string{"*"},
				AllowMutations: []string{"*"},
			}

			project.Subdomain = promptString(reader, "Project subdomain:")
			project.Region = promptString(reader, "Project region:")

			authType := promptChoice(
				reader,
				"Select authentication method:",
				[]string{"Admin Secret", "PAT"},
			)
			if authType == "Admin Secret" {
				adminSecret := promptString(reader, "Project Admin Secret:")
				project.AdminSecret = &adminSecret
			} else {
				pat := promptString(reader, "Project PAT:")
				project.PAT = &pat
			}

			projects = append(projects, project)

			if !promptYesNo(reader, "Add another project?") {
				break
			}
		}
	}

	return projects
}

//nolint:forbidigo
func promptString(reader *bufio.Reader, prompt string) string {
	fmt.Print(prompt + " ")

	input, _ := reader.ReadString('\n')

	return strings.TrimSpace(input)
}

//nolint:forbidigo
func promptYesNo(reader *bufio.Reader, prompt string) bool {
	for {
		fmt.Printf("%s (y/n) ", prompt)

		input, _ := reader.ReadString('\n')
		input = strings.ToLower(strings.TrimSpace(input))

		if input == "y" || input == "yes" {
			return true
		}

		if input == "n" || input == "no" {
			return false
		}

		fmt.Println("Please answer with 'y' or 'n'")
	}
}

//nolint:forbidigo
func promptChoice(reader *bufio.Reader, prompt string, options []string) string {
	for {
		fmt.Printf("%s\n", prompt)

		for i, opt := range options {
			fmt.Printf("%d) %s\n", i+1, opt)
		}

		fmt.Print("Enter number: ")

		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		if num := strings.TrimSpace(input); num != "" {
			switch num {
			case "1":
				return options[0]
			case "2":
				return options[1]
			}
		}

		fmt.Println("Please select a valid option")
	}
}
