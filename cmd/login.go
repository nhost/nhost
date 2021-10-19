/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
package cmd

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"os"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/mrinalwahal/cli/util"
	"github.com/spf13/cobra"
)

var email string
var password string

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Log in to your Nhost account",
	Run: func(cmd *cobra.Command, args []string) {

		// if user is already logged in, ask to logout
		if _, err := getUser(nhost.AUTH_PATH); err == nil {
			log.Fatal(ErrLoggedIn)
		}

		if email == "" {
			readEmail, err := readInput("email")
			if err != nil {
				os.Exit(0)
			}
			email = readEmail
		}

		if password == "" {
			payload, err := readInput("password")
			if err != nil {
				os.Exit(0)
			}
			password = payload
		}

		credentials, err := login(nhost.API, email, password)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to login with that email")
		}

		// delete any existing auth files
		if util.PathExists(nhost.AUTH_PATH) {
			if err = util.DeletePath(nhost.AUTH_PATH); err != nil {
				log.Debug(err)
				log.Fatalf("Failed to reset the auth file, please delete it manually from: %s, and re-run `nhost login`", nhost.AUTH_PATH)
			}
		}

		// create the auth file path if it doesn't exist
		err = os.MkdirAll(nhost.ROOT, os.ModePerm)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize Nhost root directory: ", nhost.ROOT)
		}

		// create the auth file to write it
		f, err := os.Create(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to create auth configuration file")
		}

		defer f.Close()

		// write auth file
		output, _ := json.Marshal(credentials)
		err = ioutil.WriteFile(nhost.AUTH_PATH, output, 0644)

		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to save auth configuration")
		}

	},
	PostRun: func(cmd *cobra.Command, args []string) {
		log.Info("Email verified, and you are logged in!")
		log.Info("Type `nhost list` to see your apps")
	},
}

// take email input from user
func readInput(key string) (string, error) {

	// configure interative prompt
	prompt := promptui.Prompt{
		Label: strings.Title(strings.ToLower(key)),
	}

	return prompt.Run()
}

//	Gets user's details using specified token
func getUser(authFile string) (nhost.User, error) {

	var response nhost.User
	if !util.PathExists(authFile) {
		return response, errors.New("auth source not found")
	}

	log.Debug("Fetching user data")

	credentials, err := nhost.LoadCredentials()

	//	Handle Error
	if err != nil {
		return response, err
	}

	//	Encode the data
	postBody, _ := json.Marshal(credentials)
	responseBody := bytes.NewBuffer(postBody)

	//Leverage Go's HTTP Post function to make request
	resp, err := http.Post(nhost.API+"/custom/cli/user", "application/json", responseBody)
	if err != nil {
		return response, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)
	json.Unmarshal(body, &response)

	defer resp.Body.Close()

	if response.ID == "" {
		err = errors.New("user not found")
	}

	return response, err
}

// signs the user in with email and returns verification token
func login(url, email, password string) (nhost.Credentials, error) {

	log.Debug("Authenticating with email ", email)

	var response nhost.Credentials

	//	Encode the data
	postBody, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})
	responseBody := bytes.NewBuffer(postBody)

	//	Leverage Go's HTTP Post function to make request
	resp, err := http.Post(url+"/custom/cli/login", "application/json", responseBody)
	if err != nil {
		return response, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	json.Unmarshal(body, &response)

	//Handle Error
	/*
		if response.Error.Code == "not_found" {
			return response.VerificationToken, errors.New("we couldn't find an account registered with this email, please register at https://nhost.io/register")
		} else if response.Error.Code == "unknown" {
			return response.VerificationToken, errors.New("error while trying to create a login token")
		} else if response.Error.Code == "server_not_available" {
			return response.VerificationToken, errors.New("service unavailable")
		}
	*/

	return response, err
}

func init() {
	rootCmd.AddCommand(loginCmd)

	// Here you will define your flags and configuration settings.

	// Add Persistent Flags which will work for this command
	// and all subcommands
	loginCmd.PersistentFlags().StringVarP(&email, "email", "e", "", "Email of your Nhost account")
	loginCmd.PersistentFlags().StringVarP(&password, "password", "p", "", "Password of your Nhost account")
}
