package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/nhost/cli/config"
	"github.com/nhost/cli/nhost"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"io"
	"net/http"
	"regexp"
)

var secretsCmd = &cobra.Command{
	Use:   "secrets",
	Short: "Manage your cloud secrets",
}

var secretsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all secrets",
	RunE: func(cmd *cobra.Command, args []string) error {
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

		fmt.Println("The following secrets are available:")
		fmt.Println("====================================")
		for _, secret := range appSecrets {
			fmt.Println(secret.GetName())
		}
		fmt.Println("====================================")

		return nil
	},
}

var secretsCreateCmd = &cobra.Command{
	Use:   "create secret_name secret_value",
	Short: "Create a new secret",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		secretName, secretValue := args[0], args[1]
		err := handleSecretOperation("create", secretName, secretValue)
		if err != nil {
			return err
		}

		fmt.Printf("Secret '%s' created successfully\n", secretName)

		return nil
	},
}

var secretsUpdateCmd = &cobra.Command{
	Use:   "update secret_name secret_value",
	Short: "Update an existing secret",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		secretName, secretValue := args[0], args[1]
		err := handleSecretOperation("update", secretName, secretValue)
		if err != nil {
			return err
		}

		fmt.Printf("Secret '%s' updated successfully\n", secretName)

		return nil
	},
}

var secretsDeleteCmd = &cobra.Command{
	Use:   "delete secret_name",
	Short: "Delete an existing secret",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		secretName := args[0]
		err := handleSecretOperation("delete", secretName, "")
		if err != nil {
			return err
		}

		fmt.Printf("Secret '%s' deleted successfully\n", secretName)

		return nil
	},
}

func handleSecretOperation(op, secretName, secretValue string) error {
	creds, err := nhost.LoadCredentials()
	if err != nil {
		return errors.Wrap(err, "failed to load credentials")
	}

	appInfo, err := nhost.Info()
	if err != nil {
		return errors.Wrap(err, "failed to read .nhost/nhost.yaml, run 'nhost link' first")
	}

	var payload []byte
	var httpMethod string

	switch op {
	case "create":
		httpMethod = http.MethodPost
		payload, err = makeSecretPayload(creds.ID, appInfo.ID, creds.Token, secretName, secretValue)
		if err != nil {
			return errors.Wrap(err, "failed to create payload")
		}
	case "update":
		httpMethod = http.MethodPut
		payload, err = makeSecretPayload(creds.ID, appInfo.ID, creds.Token, secretName, secretValue)
		if err != nil {
			return errors.Wrap(err, "failed to create payload")
		}
	case "delete":
		httpMethod = http.MethodDelete
		payload, err = makeSecretPayload(creds.ID, appInfo.ID, creds.Token, secretName, "")
		if err != nil {
			return errors.Wrap(err, "failed to create payload")
		}
	default:
		return fmt.Errorf("invalid operation: %s", op)
	}

	req, err := http.NewRequest(httpMethod, secretsAPIEndpoint(), bytes.NewBuffer(payload))
	if err != nil {
		return errors.Wrap(err, "failed to make an http request")
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return errors.Wrap(err, "failed to call nhost API")
	}

	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.Wrap(err, "failed to read response body")
	}

	if resp.StatusCode != http.StatusOK {
		// try to extract error message from response body
		msg, err := extractFailedResponseMessage(respBody)
		if err != nil {
			return fmt.Errorf("failed to %s secret", op)
		}

		return fmt.Errorf("failed to %s secret: %s", op, msg)
	}

	return nil
}

func extractFailedResponseMessage(body []byte) (string, error) {
	type errorStruct struct {
		Message string `json:"message"`
	}

	type response struct {
		Errors []errorStruct `json:"errors"`
	}

	type responseBody struct {
		Response response `json:"response"`
	}

	// extract JSON from response body
	re := regexp.MustCompile(`({.*})`)
	match := re.FindStringSubmatch(string(body))
	if len(match) != 2 {
		return "", fmt.Errorf("failed to extract JSON from response")
	}

	jsonResponse := match[1]

	var resp responseBody
	err := json.Unmarshal([]byte(jsonResponse), &resp)
	if err != nil {
		return "", errors.Wrap(err, "failed to unmarshal response body")
	}

	if len(resp.Response.Errors) == 0 {
		return "", fmt.Errorf("failed to extract error message from response")
	}

	return resp.Response.Errors[0].Message, nil
}

func makeSecretPayload(userId, appId, cliToken, secretName, secretValue string) ([]byte, error) {
	payload := struct {
		AppID    string `json:"appId"`
		UserID   string `json:"id"`
		CliToken string `json:"token"`
		Secret   struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"secret"`
	}{
		AppID:    appId,
		UserID:   userId,
		CliToken: cliToken,
		Secret: struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		}{
			Name:  secretName,
			Value: secretValue,
		},
	}

	return json.Marshal(payload)
}

func secretsAPIEndpoint() string {
	return nhost.API + "/custom/cli/secret"
}

func init() {
	rootCmd.AddCommand(secretsCmd)
	secretsCmd.AddCommand(secretsListCmd)
	secretsCmd.AddCommand(secretsCreateCmd)
	secretsCmd.AddCommand(secretsUpdateCmd)
	secretsCmd.AddCommand(secretsDeleteCmd)
}
