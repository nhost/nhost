package controller

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/tui"
)

func InitRemote(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	domain string,
	userDefinedHasura string,
) error {
	proj, err := GetAppInfo(ctx, p, cl)
	if err != nil {
		return err
	}

	session, err := LoadSession(ctx, p, cl)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	if err := configPull(ctx, p, cl, proj, session); err != nil {
		return err
	}

	if err := initInit(ctx); err != nil {
		return err
	}

	hasuraAdminSecret, err := cl.GetHasuraAdminSecret(
		ctx, proj.ID, graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get hasura admin secret: %w", err)
	}

	hasuraEndpoint := fmt.Sprintf(
		"https://%s.hasura.%s.%s",
		proj.Subdomain,
		proj.Region.AwsName,
		domain,
	)

	hasuraClient, err := hasura.InitClient(
		hasuraEndpoint,
		hasuraAdminSecret.GetApp().GetConfig().GetHasura().AdminSecret,
		*hasuraAdminSecret.GetApp().GetConfig().GetHasura().Version,
		userDefinedHasura,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to init hasura client: %w", err)
	}

	_, err = pullMigration(p, hasuraClient, "init")
	if err != nil {
		return err
	}

	return nil
}

func createInitialMigration(
	p Printer,
	client *hasura.Client,
	migration hasura.Migration,
	schemas []string,
	enumTables []hasura.TableEntry,
) ([]byte, error) {
	p.Println(tui.Info("Creating initial migration"))

	migrationData, err := client.Migration(pgDumpSchemasFlags(schemas))
	if err != nil {
		return nil, fmt.Errorf("failed to get migration data: %w", err)
	}

	b := wrapFunctionsDump(migrationData)

	if err := os.MkdirAll(migration.Location, os.ModePerm); err != nil {
		return nil, fmt.Errorf("failed to create migration directory: %w", err)
	}

	f, err := os.Create(filepath.Join(migration.Location, "up.sql"))
	if err != nil {
		return nil, fmt.Errorf("failed to create migration file: %w", err)
	}
	defer f.Close()

	if len(enumTables) > 0 {
		seeds, err := client.ApplySeeds(enumTables)
		if err != nil {
			return nil, fmt.Errorf("failed to apply seeds: %w", err)
		}

		// append the fetched seed data
		b = append(b, seeds...)
	}

	if _, err = f.Write(migration.Data); err != nil {
		return nil, fmt.Errorf("failed to write migration file: %w", err)
	}

	return b, nil
}

func migrateApply(p Printer, client *hasura.Client, sourceName string) error {
	p.Println(tui.Info("Clearing remote migration for source: %s", sourceName))

	if err := client.ClearMigration(sourceName); err != nil {
		return fmt.Errorf("failed to clear migration: %w", err)
	}

	args := []string{client.CLI, "migrate", "apply", "--skip-execution"}
	args = append(args, client.CommonOptions...)

	execute := exec.Cmd{ //nolint:exhaustruct
		Path: client.CLI,
		Args: args,
		Dir:  nhost.NHOST_DIR,
	}

	if _, err := execute.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to verify migrations: %w", err)
	}

	return nil
}

func exportMetadata(p Printer, client *hasura.Client) error {
	p.Println(tui.Info("Exporting metadata"))

	args := []string{client.CLI, "metadata", "export"}
	args = append(args, client.CommonOptionsWithoutDB...)

	execute := exec.Cmd{ //nolint:exhaustruct
		Path: client.CLI,
		Args: args,
		Dir:  nhost.NHOST_DIR,
	}

	if _, err := execute.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to export metadata: %w", err)
	}

	return nil
}

func pullMigration(p Printer, client *hasura.Client, name string) (hasura.Migration, error) {
	var migration hasura.Migration

	p.Println(tui.Info("Creating migration '%s'", name))

	metadata, err := client.GetMetadata()
	if err != nil {
		return migration, fmt.Errorf("failed to get metadata: %w", err)
	}

	migration = hasura.Migration{ //nolint:exhaustruct
		Name: name,
	}

	sourceName := "default"
	if len(metadata.Sources) > 0 {
		sourceName = metadata.Sources[0].Name
	}

	migration = migration.Init(sourceName)

	//  Fetch list of all ALLOWED schemas before applying
	schemas, err := client.GetSchemas()
	if err != nil {
		return migration, fmt.Errorf("failed to get schemas: %w", err)
	}

	var enumTables []hasura.TableEntry
	var migrationTables []string
	for _, source := range metadata.Sources {
		//  Filter enum tables
		enumTables = append(enumTables, filterEnumTables(source.Tables)...)

		//	Filter migration tables
		migrationTables = append(migrationTables, getMigrationTables(schemas, source.Tables)...)
	}

	//  fetch migrations
	if len(migrationTables) > 0 {
		b, err := createInitialMigration(p, client, migration, migrationTables, enumTables)
		if err != nil {
			return migration, err
		}
		migration.Data = b
	}

	if err := migrateApply(p, client, sourceName); err != nil {
		return migration, err
	}

	if err := exportMetadata(p, client); err != nil {
		return migration, err
	}

	return migration, nil
}

func filterEnumTables(tables []hasura.TableEntry) []hasura.TableEntry {
	var fromTables []hasura.TableEntry

	for _, table := range tables {
		if table.IsEnum != nil {
			fromTables = append(fromTables, table)
		}
	}

	return fromTables
}

func getMigrationTables(schemas []string, tables []hasura.TableEntry) []string {
	var response []string

	for _, table := range tables {
		for _, schema := range schemas {
			if table.Table.Schema == schema {
				response = append(response, "--table")
				response = append(response, fmt.Sprintf(
					`%s.%s`,
					schema,
					table.Table.Name,
				))
			}
		}
	}

	/*
		for _, value := range filteredValues {
			if value != "public.users" {
				fromTables = append(fromTables, "--table")
				fromTables = append(fromTables, value)
			}
		}
	*/
	return response
}

func pgDumpSchemasFlags(schemas []string) []string {
	schemasFlags := make([]string, 0, len(schemas)*2) //nolint:gomnd

	for _, schema := range schemas {
		schemasFlags = append(schemasFlags, "--schema", schema)
	}

	return schemasFlags
}

func wrapFunctionsDump(dump []byte) []byte {
	return bytes.ReplaceAll(dump, []byte("CREATE FUNCTION"), []byte("CREATE OR REPLACE FUNCTION"))
}
