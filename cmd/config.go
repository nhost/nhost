package cmd

import (
	"fmt"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/config"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/secrets"
	"github.com/nhost/cli/util"
	"github.com/pelletier/go-toml/v2"
	"github.com/spf13/cobra"
	"os"
	"path/filepath"
	"strings"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage your Nhost configuration",
}

var pullConfigCmd = &cobra.Command{
	Use:  "pull",
	Long: `Get cloud configuration`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if util.PathExists(nhost.CONFIG_PATH) {
			return fmt.Errorf("config already exists at %s", nhost.CONFIG_PATH)
		}

		creds, err := nhost.LoadCredentials()
		if err != nil {
			log.WithError(err).Fatal("Failed to load credentials")
		}

		appInfo, err := nhost.Info()
		if err != nil {
			log.WithError(err).Fatal("Failed to read .nhost/nhost.yaml, run 'nhost link' first")
		}

		conf, appSecrets, err := config.GetRemoteAppConfig(creds, appInfo.ID)
		if err != nil {
			return fmt.Errorf("failed to get remote app config: %v", err)
		}

		confData, err := toml.Marshal(conf)
		if err != nil {
			return fmt.Errorf("failed to marshal config: %v", err)
		}

		if err := os.WriteFile(filepath.Join(util.WORKING_DIR, ".secrets"), config.DumpSecrets(anonymizeAppSecrets(appSecrets)), 0644); err != nil {
			return fmt.Errorf("failed to write secrets file: %w", err)
		}

		if err := os.WriteFile(nhost.CONFIG_PATH, confData, 0644); err != nil {
			return fmt.Errorf("failed to write config file: %w", err)
		}

		// check if .secrets is in .gitignore
		gitIgnore, err := os.ReadFile(filepath.Join(nhost.GITIGNORE))
		if err != nil {
			log.WithError(err).Error("Failed to read .gitignore")
		} else {
			if !strings.Contains(string(gitIgnore), ".secrets") {
				if err := os.WriteFile(nhost.GITIGNORE, append(gitIgnore, []byte("\n.secrets")...), 0644); err != nil {
					log.WithError(err).Error("Failed to write .gitignore")
				}
			}
		}

		log.Info("Successfully generated config and secrets file")
		return nil
	},
}

var validateConfigCmd = &cobra.Command{
	Use:  "validate",
	Long: `Validate configuration`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// read flags
		local, err := cmd.Flags().GetBool("local")
		if err != nil {
			return err
		}

		remote, err := cmd.Flags().GetBool("remote")
		if err != nil {
			return err
		}

		if !local && !remote {
			local = true
		}

		localConfigData, err := os.ReadFile(nhost.CONFIG_PATH)
		if err != nil {
			return fmt.Errorf("failed to read config file: %v", err)
		}

		if local {
			secr, err := secrets.ParseSecrets(filepath.Join(util.WORKING_DIR, ".secrets"))
			if err != nil {
				return fmt.Errorf("failed to get local secrets: %v", err)
			}

			if _, err = config.ValidateAndResolve(localConfigData, secr); err != nil {
				log.WithError(err).Error("Configuration is invalid")
				return nil
			}
		} else {
			creds, err := nhost.LoadCredentials()
			if err != nil {
				log.WithError(err).Fatal("Failed to load credentials")
			}

			appInfo, err := nhost.Info()
			if err != nil {
				log.WithError(err).Fatal("Failed to read .nhost/nhost.yaml, run 'nhost link' first")
			}

			_, appSecrets, err := config.GetRemoteAppConfig(creds, appInfo.ID)
			if err != nil {
				return fmt.Errorf("failed to get remote app config: %v", err)
			}

			if _, err = config.ValidateAndResolve(localConfigData, appSecrets); err != nil {
				log.WithError(err).Error("Configuration is invalid")
				return nil
			}
		}

		log.Info("Configuration is valid")
		return nil
	},
}

var showFullExampleConfigCmd = &cobra.Command{
	Use:  "show-full-example",
	Long: `Show full example configuration`,
	RunE: func(cmd *cobra.Command, args []string) error {
		exampleConf, err := config.FullExampleConfig()
		if err != nil {
			return fmt.Errorf("failed to get full example config: %v", err)
		}

		fmt.Println(string(exampleConf))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(pullConfigCmd)
	configCmd.AddCommand(validateConfigCmd)
	configCmd.AddCommand(showFullExampleConfigCmd)
	validateConfigCmd.Flags().Bool("local", false, "Validate local configuration")
	validateConfigCmd.Flags().Bool("remote", false, "Validate remote configuration")
	validateConfigCmd.MarkFlagsMutuallyExclusive("local", "remote")
}

func anonymizeAppSecrets(secrets model.Secrets) model.Secrets {
	defaultSecretsMapping := map[string]string{}
	defaultSecrets := config.DefaultSecrets()
	for _, defaultSecret := range defaultSecrets {
		defaultSecretsMapping[defaultSecret.GetName()] = defaultSecret.GetValue()
	}

	anonymized := model.Secrets{}
	for _, v := range secrets {
		if defaultSecretValue, ok := defaultSecretsMapping[v.GetName()]; ok {
			anonymized = append(anonymized, &model.ConfigEnvironmentVariable{
				Name:  v.GetName(),
				Value: defaultSecretValue,
			})
			continue
		}

		anonymized = append(anonymized, &model.ConfigEnvironmentVariable{
			Name:  v.GetName(),
			Value: "FIXME",
		})
	}
	return anonymized
}
