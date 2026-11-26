package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

func Printlist(ce *CliEnv, orgs *graphql.GetOrganizationsApps) error {
	if len(orgs.GetOrganizations()) == 0 {
		return errors.New("no apps found") //nolint:err113
	}

	num := Column{
		Header: "#",
		Rows:   make([]string, 0),
	}
	subdomain := Column{
		Header: "Subdomain",
		Rows:   make([]string, 0),
	}
	project := Column{
		Header: "Project",
		Rows:   make([]string, 0),
	}
	organization := Column{
		Header: "Organization",
		Rows:   make([]string, 0),
	}
	region := Column{
		Header: "Region",
		Rows:   make([]string, 0),
	}

	for _, org := range orgs.GetOrganizations() {
		for _, app := range org.Apps {
			num.Rows = append(num.Rows, strconv.Itoa(len(num.Rows)+1))
			subdomain.Rows = append(subdomain.Rows, app.Subdomain)
			project.Rows = append(project.Rows, app.Name)
			organization.Rows = append(organization.Rows, org.Name)
			region.Rows = append(region.Rows, app.Region.Name)
		}
	}

	ce.Println("%s", Table(num, subdomain, project, organization, region))

	return nil
}

func confirmApp(ce *CliEnv, app *graphql.AppSummaryFragment) error {
	ce.PromptMessage("Enter project subdomain to confirm: ")

	confirm, err := ce.PromptInput(false)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	if confirm != app.Subdomain {
		return errors.New("input doesn't match the subdomain") //nolint:err113
	}

	return nil
}

func getApp(
	orgs *graphql.GetOrganizationsApps,
	idx string,
) (*graphql.AppSummaryFragment, error) {
	x := 1

	for _, org := range orgs.GetOrganizations() {
		for _, a := range org.GetApps() {
			if strconv.Itoa(x) == idx {
				return a, nil
			}

			x++
		}
	}

	return nil, errors.New("invalid input") //nolint:err113
}

func (ce *CliEnv) Link(ctx context.Context) (*graphql.AppSummaryFragment, error) {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get nhost client: %w", err)
	}

	orgs, err := cl.GetOrganizationsApps(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get projects: %w", err)
	}

	if len(orgs.GetOrganizations()) == 0 {
		return nil, errors.New("no apps found") //nolint:err113
	}

	if err := Printlist(ce, orgs); err != nil {
		return nil, err
	}

	ce.PromptMessage("Select the project # to link: ")

	idx, err := ce.PromptInput(false)
	if err != nil {
		return nil, fmt.Errorf("failed to read input: %w", err)
	}

	app, err := getApp(orgs, idx)
	if err != nil {
		return nil, err
	}

	if err := confirmApp(ce, app); err != nil {
		return nil, err
	}

	if err := os.MkdirAll(ce.Path.DotNhostFolder(), 0o755); err != nil { //nolint:mnd
		return nil, fmt.Errorf("failed to create .nhost folder: %w", err)
	}

	if err := MarshalFile(app, ce.Path.ProjectFile(), json.Marshal); err != nil {
		return nil, fmt.Errorf("failed to marshal project information: %w", err)
	}

	return app, nil
}
