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
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var email string

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to your Nhost account",
	Long:  `Login to your existing Nhost account.`,
	Run: func(cmd *cobra.Command, args []string) {

		// if user is already logged in, ask to logout
		if _, err := validateAuth(authPath); err == nil {
			log.Fatal("You are already logged in, first logout with `nhost logout`")
		}

		if email == "" {

			readEmail, err := readEmail()
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to read email")
			}
			email = readEmail
		}

		token, err := login(apiURL, email)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to login with that email")
		}

		log.Info("We have sent you an email on \"" + email + "\". Confirm the email to login")

		verifiedToken, err := runVerificationLoop(apiURL, email, token)
		if err != nil {
			log.Debug(err)
			log.Fatal("Login verification failed")
		}

		if len(verifiedToken) > 0 {

			// prepare credentials to auth file
			credentials, _ := json.MarshalIndent(map[string]string{
				"email": email,
				"token": verifiedToken,
			}, "", " ")

			// delete any existing auth files
			if pathExists(authPath) {
				if err = deletePath(authPath); err != nil {
					log.Debug(err)
					log.Fatalf("Failed to reset the auth file, please delete it manually from: %s, and re-run `nhost login`", authPath)
				}
			}

			// create the auth file to write it
			f, err := os.Create(authPath)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to create auth configuration file")
			}

			defer f.Close()

			// write auth file
			err = writeToFile(authPath, string(credentials), "end")

			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to save auth configuration")
			}

			// validate auth
			_, err = validateAuth(authPath)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to validate authentication")
			}

			log.Info("Email verified, and login complete!")
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

	log.Debug("Validating authentication")

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
	if err != nil {
		return response.User, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	//var res map[string]interface{}
	// we unmarshal our body byteArray which contains our
	// jsonFile's content into 'user' strcuture which we initialized above
	json.Unmarshal(body, &response)

	//fmt.Println(res["user"].(map[string]interface{})["teams"].([]interface{})[0].(map[string]interface{})["team"])

	defer resp.Body.Close()

	//Handle Error
	if response.Error.Code == "server_not_available" {
		return response.User, errors.New("server unavailable, please retry again later")
	} else if response.Error.Code == "invalid_token" {
		return response.User, errors.New("invalid auth token, please run 'nhost login' again")
	}

	return response.User, err
}

func runVerificationLoop(url, email, token string) (string, error) {

	log.Debug("Verifying your login")

	timeout := time.After(60 * time.Second)
	ticker := time.Tick(1 * time.Second)

	// Keep trying until we're timed out or get a result/error
	for {
		select {
		// Got a timeout! fail with a timeout error
		case <-timeout:
			return "", errors.New("auth verification timed out")
		// Got a tick, we should check on verify()
		case <-ticker:
			token, err := verify(url, email, token)
			if err != nil {
				// We may return, or ignore the error
				return "", err
			} else if len(token) > 0 {
				// verify() done! let's return
				return token, nil
			}
			// verify() isn't done yet, but it didn't fail either, let's try again
		}
	}
}

// validate the verification token
func verify(url, email, token string) (string, error) {

	log.Debug("Verifying login token")

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
		return "", err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var response AuthValidation
	json.Unmarshal(body, &response)

	// if token returned, verification is successful
	if len(response.VerifiedToken) > 0 {
		return response.VerifiedToken, nil
	}

	//Handle Error
	if response.Error.Code == "invalid_verification_token" {
		return "", errors.New("your verification token is invalid")
	} else if response.Error.Code == "server_not_available" {
		return "", errors.New("service unavailable")
	}

	return "", err
}

// signs the user in with email and returns verification token
func login(url, email string) (string, error) {

	log.Debug("Authenticating with email ", email)

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
	} else if response.Error.Code == "unknown" {
		return response.VerificationToken, errors.New("error while trying to create a login token")
	} else if response.Error.Code == "server_not_available" {
		return response.VerificationToken, errors.New("service unavailable")
	}

	return response.VerificationToken, err
}

// fetches saved credentials from auth file
func getCredentials(authFile string) (Credentials, error) {

	log.Debug("Fetching credentials from saved auth configuration at ", authFile)

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
