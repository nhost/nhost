/*
Copyright © 2021 Mrinal Wahal mrinalwahal@gmail.com

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
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile string
	verbose bool

	// rootCmd represents the base command when called without any subcommands
	rootCmd = &cobra.Command{
		Use:   "nhost",
		Short: "Open Source Firebase Alternative with GraphQL",
		Long: `
  Nhost is a full-fledged serverless backend for Jamstack and client-serverless applications. 
  It enables developers to build dynamic websites without having to worry about infrastructure, 
  data storage, data access and user management.
  Nhost was inspired by Google Firebase, but uses SQL, GraphQL and has no vendor lock-in.
 
  Or simply put, it's an open source firebase alternative with GraphQL, which allows 
  passionate developers to build apps fast without managing infrastructure - from MVP to global scale.
  `,
		// Uncomment the following line if your bare application
		// has an action associated with it:
		//	Run: func(cmd *cobra.Command, args []string) { },
		/*
			PersistentPreRun: func(cmd *cobra.Command, args []string) {
				// start the spinner
				s.Start()
			},
			PersistentPostRun: func(cmd *cobra.Command, args []string) {
				// stop the spinner
				s.Stop()
			},
		*/
	}
)

// Initialize common constants and variables used by multiple commands
const (
	apiURL = "https://customapi.nhost.io"
)

var (

	// fetch current working directory
	workingDir, _ = os.Getwd()
	nhostDir      = path.Join(workingDir, "nhost")
	dotNhost      = path.Join(workingDir, ".nhost")

	// find user's home directory
	home, _ = os.UserHomeDir()

	// generate Nhost root directory for HOME
	NHOST_DIR = path.Join(home, ".nhost")

	// generate authentication file location
	authPath = path.Join(NHOST_DIR, "auth.json")

	// generate path for migrations
	migrationsDir = path.Join(nhostDir, "migrations")

	// generate path for metadata
	metadataDir = path.Join(nhostDir, "metadata")

	// generate path for .env.development
	envFile = path.Join(workingDir, ".env.development")

	/*
		// configure the status spinner
		s = spinner.New(spinner.CharSets[35], 100*time.Millisecond)
	*/
)

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		log.Println(err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	// Here you will define your flags and configuration settings.
	// Cobra supports persistent flags, which, if defined here,
	// will be global for your application.

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.nhost.yaml)")

	//rootCmd.PersistentFlags().StringP("author", "a", "YOUR NAME", "author name for copyright attribution")
	//rootCmd.PersistentFlags().StringVarP(&userLicense, "license", "l", "", "name of license for the project")
	//rootCmd.PersistentFlags().Bool("viper", true, "use Viper for configuration")
	//viper.BindPFlag("author", rootCmd.PersistentFlags().Lookup("author"))
	//viper.BindPFlag("useViper", rootCmd.PersistentFlags().Lookup("viper"))
	//viper.SetDefault("author", "NAME HERE <EMAIL ADDRESS>")
	//viper.SetDefault("license", "apache")

	//rootCmd.AddCommand(versionCmd)
	//rootCmd.AddCommand(initCmd)

	// Cobra also supports local flags, which will only run
	// when this action is called directly.
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "show informational logs")
}

// validates whether the CLI utlity is installed or not
func verifyUtility(command string) bool {

	if verbose {
		printMessage("validating Hasura CLI installation...", "info")
	}

	cmd := exec.Command("command", "-v", command)
	return cmd.Run() != nil
}

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

// deletes the given file/folder path and unlink from filesystem
func deletePath(filePath string) error {
	err := os.RemoveAll(filePath)
	return err
}

// print error and handle verbose
func throwError(data error, message string, fatal bool) {

	var Bold = "\033[1m"
	var Reset = "\033[0m"
	var Red = "\033[31m"

	if verbose {
		log.Println(Bold + Red + data.Error() + Reset)
	}

	fmt.Println(Bold + Red + message + Reset)

	if fatal {
		os.Exit(1)
	}
}

// Print coloured output to console
func printMessage(data, color string) {

	var Bold = "\033[1m"
	var Reset = "\033[0m"
	var Green = "\033[32m"
	//var Blue = "\033[34m"
	var Yellow = "\033[33m"
	var Cyan = "\033[36m"
	//var Gray = "\033[37m"
	//var White = "\033[97m"

	selected_color := ""

	switch color {
	case "success":
		selected_color = Green
	case "warn":
		selected_color = Yellow
	case "info":
		selected_color = Cyan
	}

	//s.Suffix = selected_color + data + Reset

	fmt.Println(Bold + selected_color + data + Reset)
}

func writeToFile(filePath, data, position string) error {

	// is position is anything else than start/end,
	// or even blank, make it start
	if position != "start" && position != "end" {
		position = "end"
	}

	// open and read the contents of the file
	f, err := ioutil.ReadFile(filePath)
	if err != nil {
		return err
	}

	var buffer bytes.Buffer

	buffer.WriteString(data)
	s := buffer.String()
	buffer.Reset()

	// add rest of file data at required position i.e. start or end
	if position == "start" {
		buffer.WriteString(s + string(f))
	} else {
		buffer.WriteString(string(f) + s)
	}

	// write the data to the file
	err = ioutil.WriteFile(filePath, buffer.Bytes(), 0644)
	return err
}

// checks the data type of a particular data value
func typeof(v interface{}) string {
	switch v.(type) {
	case string:
		return "string"
	case int:
		return "int"
	case float64:
		return "float64"
	case map[string]string:
		return "map[string]string"
	case map[string]interface{}:
		return "map[string]interface{}"
	//... etc
	default:
		return "unknown"
	}
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {

		// Search config in home directory with name ".nhost" (without extension).
		viper.AddConfigPath(home)
		viper.SetConfigName(".nhost")
	}

	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		log.Println("using config file:", viper.ConfigFileUsed())
	}
}
