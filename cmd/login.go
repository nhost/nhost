/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var email string

type (

	// Authentication credentials structure
	Credentials struct {
		Email string `json:"email"`
		Token string `json:"token"`
	}

	// Authentication validation response
	AuthValidation struct {
		User              User   "user"
		Error             Error  "error"
		Email             string `json:"email"`
		VerificationToken string `json:"verification_token"`
	}

	Error struct {
		Code  string "code"
		Email string "email"
	}

	// Nhost user structure
	User struct {
		Projects []Project "projects"
		Teams    []Team    "teams"
	}

	// Nhost project domains
	Domains struct {
		Hasura string `json:"hasura_domain,omitempty"`
	}

	// Nhost individual team structure
	Team struct {
		Name     string    "name"
		Projects []Project "projects"
	}

	// Nhost project structure
	Project struct {
		ID                          string            `json:"id"`
		UserID                      string            `json:"user_id"`
		Team                        Team              `json:"team,omitempty"`
		TeamID                      string            `json:"team_id,omitempty"`
		Name                        string            `json:"name"`
		HasuraGQEVersion            string            `json:"hasura_gqe_version,omitempty"`
		BackendVersion              string            `json:"backend_version,omitempty"`
		HasuraGQEAdminSecret        string            `json:"hasura_gqe_admin_secret,omitempty"`
		PostgresVersion             string            `json:"postgres_version,omitempty"`
		HasuraGQECustomEnvVariables map[string]string `json:"hasura_gqe_custom_env_variables,omitempty"`
		BackendUserFields           string            `json:"backend_user_fields,omitempty"`
		HBPDefaultAllowedUserRoles  string            `json:"hbp_DEFAULT_ALLOWED_USER_ROLES,omitempty"`
		HBPRegistrationCustomFields string            `json:"hbp_REGISTRATION_CUSTOM_FIELDS,omitempty"`
		HBPAllowedUserRoles         string            `json:"hbp_allowed_user_roles,omitempty"`
		ProjectDomains              Domains           `json:"project_domain"`
		ProjectEnvVars              map[string]string `json:"project_env_vars,omitempty"`
	}
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to your Nhost account",
	Long:  `Login to your existing Nhost account.`,
	Run: func(cmd *cobra.Command, args []string) {

		/*
			credentials, err := getCredentials(authPath)

			//Handle Error
			if err != nil {
				log.Println("error getting credentials: ", err)
			}

			err = login(apiURL, credentials.Email)
		*/
		if email == "" {

			readEmail, err := readEmail()
			if err != nil {
				throwError(err, "couldn't read email", true)
			}
			email = readEmail
		}

		token, err := login(apiURL, email)
		if err != nil {
			throwError(err, "failed to login with that email", true)
		}

		fmt.Println(token)
		verified, err := runVerificationLoop(apiURL, email, token)
		if err != nil {
			throwError(err, "login verification failed", true)
		}
		if verified {

			// write credentials to auth file
			credentials, _ := json.MarshalIndent(map[string]string{
				"email": email,
				"token": token,
			}, "", " ")
			err := writeToFile(authPath, string(credentials), "end")

			if err != nil {
				throwError(err, "failed to save authention config", true)
			}
			// validate auth
			user, err := validateAuth(authPath)
			if err != nil {
				throwError(err, "failed to validate auth", true)
			}
			fmt.Println(user)
		}
	},
}

// take email input from user
func readEmail() (string, error) {

	// configure interative prompt
	prompt := promptui.Prompt{
		Label: "Email",
	}

	email, err := prompt.Run()
	return email, err
}

// ValidateAuth func confirms whether user is logged in or not
func validateAuth(authFile string) (User, error) {

	if verbose {
		printMessage("validating authentication...", "info")
	}

	var response AuthValidation

	credentials, err := getCredentials(authFile)

	//Handle Error
	if err != nil {
		return response.User, err
	}

	//Encode the data
	postBody, _ := json.Marshal(credentials)
	responseBody := bytes.NewBuffer(postBody)

	//Leverage Go's HTTP Post function to make request
	resp, err := http.Post(apiURL+"/custom/cli/login/validate", "application/json", responseBody)

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)
	//fmt.Println(string(body))

	// we unmarshal our body byteArray which contains our
	// jsonFile's content into 'user' strcuture which we initialized above
	json.Unmarshal(body, &response)

	defer resp.Body.Close()

	//Handle Error
	if response.Error.Code == "server_not_available" {
		return response.User, errors.New("server unavailable, please retry again later")
	} else if response.Error.Code == "invalid_token" {
		return response.User, errors.New("invalid auth token, please run 'nhost login' again")
	}

	return response.User, err
}

func runVerificationLoop(url, email, token string) (bool, error) {

	if verbose {
		printMessage("verifying your login...", "info")
	}

	timeout := time.After(10 * time.Second)
	ticker := time.Tick(1 * time.Second)

	// Keep trying until we're timed out or get a result/error
	for {
		select {
		// Got a timeout! fail with a timeout error
		case <-timeout:
			return false, errors.New("authverification timed out")
		// Got a tick, we should check on verify()
		case <-ticker:
			ok, err := verify(url, email, token)
			if err != nil {
				// We may return, or ignore the error
				return false, err
				// verify() done! let's return
			} else if ok {
				return true, nil
			}
			// verify() isn't done yet, but it didn't fail either, let's try again
		}
	}
}

// validate the verification token
func verify(url, email, token string) (bool, error) {

	//Leverage Go's HTTP Post function to make request
	req, _ := http.NewRequest(
		http.MethodGet,
		url+"/custom/cli/login/verify",
		nil,
	)

	queries := req.URL.Query()
	queries.Add("email", email)
	queries.Add("token", token)
	req.URL.RawQuery = queries.Encode()

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var response AuthValidation
	json.Unmarshal(body, &response)

	//Handle Error
	if response.Error.Code == "invalid_verification_token" {
		return false, errors.New("your verification token is invalid")
	}

	return true, err
}

// signs the user in with email and returns verification token
func login(url, email string) (string, error) {

	if verbose {
		printMessage("authenticating...", "info")
	}

	var response AuthValidation

	//Encode the data
	postBody, _ := json.Marshal(map[string]string{
		"email": email,
	})
	responseBody := bytes.NewBuffer(postBody)

	//Leverage Go's HTTP Post function to make request
	resp, err := http.Post(url+"/custom/cli/login", "application/json", responseBody)
	if err != nil {
		return response.VerificationToken, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	json.Unmarshal(body, &response)

	//Handle Error
	if response.Error.Code == "not_found" {
		return response.VerificationToken, errors.New("we couldn't find an account registered with this email, please register at https://nhost.io/register")
	}

	return response.VerificationToken, err
}

// fetches saved credentials from auth file
func getCredentials(authFile string) (Credentials, error) {

	// we initialize our credentials array
	var credentials Credentials

	// Open our jsonFile
	jsonFile, err := os.Open(authFile)
	// if we os.Open returns an error then handle it
	if err != nil {
		fmt.Println(err)
	}

	// defer the closing of our jsonFile so that we can parse it later on
	defer jsonFile.Close()

	// read our opened xmlFile as a byte array.
	byteValue, _ := ioutil.ReadAll(jsonFile)

	// we unmarshal our byteArray which contains our
	// jsonFile's content into 'credentials' which we defined above
	json.Unmarshal(byteValue, &credentials)

	return credentials, err
}

func init() {
	rootCmd.AddCommand(loginCmd)

	// Here you will define your flags and configuration settings.

	// Add Persistent Flags which will work for this command
	// and all subcommands
	loginCmd.PersistentFlags().StringVarP(&email, "email", "e", "", "Email of your Nhost account")
}
