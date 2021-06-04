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
	_ "embed"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/mattn/go-colorable"
	"github.com/nhost/cli/formatter"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/cobra/doc"
	"github.com/spf13/viper"
)

const (
	apiURL = "https://customapi.nhost.io"

	// initialize console colours
	Bold  = "\033[1m"
	Reset = "\033[0m"
	Green = "\033[32m"
	// Blue = "\033[34m"
	Yellow = "\033[33m"
	Cyan   = "\033[36m"
	Red    = "\033[31m"
	// Gray = "\033[37m"
	// White = "\033[97m"
)

var (
	cfgFile string
	log     = logrus.New()
	DEBUG   bool
	JSON    bool

	LOG_FILE = ""

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

	// rootCmd represents the base command when called without any subcommands
	rootCmd = &cobra.Command{
		Use:   "nhost",
		Short: "Open Source Firebase Alternative with GraphQL",
		Long: `
		_   ____               __ 
		/ | / / /_  ____  _____/ /_
	   /  |/ / __ \/ __ \/ ___/ __/
	  / /|  / / / / /_/ (__  ) /_  
	 /_/ |_/_/ /_/\____/____/\__/  
								   
	 
  Nhost.io is a full-fledged serverless backend for Jamstack and client-serverless applications. 
  It enables developers to build dynamic websites without having to worry about infrastructure, 
  data storage, data access and user management.
  Nhost was inspired by Google Firebase, but uses SQL, GraphQL and has no vendor lock-in.
 
  Or simply put, it's an open source firebase alternative with GraphQL, which allows 
  passionate developers to build apps fast without managing infrastructure - from MVP to global scale.
	
  Ask your questions: https://github.com/nhost/nhost/discussions/new
  Chat with our team: https://discord.com/invite/9V7Qb2U
  Open feature requests or report bugs: https://github.com/nhost/cli/issues
  `,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {

			// reset the umask before creating directories anywhere in this program
			// otherwise applied permissions, might get affected
			resetUmask()

			// initialize the logger for all commands,
			// including subcommands

			log.SetOutput(colorable.NewColorableStdout())

			// initialize logger formatter
			formatter := &formatter.Formatter{
				HideKeys:      true,
				ShowFullLevel: true,
				FieldsOrder:   []string{"component", "category"},
				Timestamps:    false,
			}

			// if DEBUG flag is true, show logger level to debug
			if DEBUG {
				log.SetLevel(logrus.DebugLevel)
			}

			// if JSON flag has been supplied,
			// format the logs to JSON
			if JSON {
				log.SetFormatter(&logrus.JSONFormatter{
					TimestampFormat: time.Stamp,
				})
			} else {

				// otherwise set the pre-configured formatter
				log.SetFormatter(formatter)
			}

			// if the user has specified a log write,
			//simultaneously write logs to that file as well
			// along with stdOut

			if LOG_FILE != "" {

				formatter.Timestamps = true
				formatter.NoColors = true

				logFile, err := os.OpenFile(LOG_FILE, os.O_CREATE|os.O_APPEND|os.O_RDWR, 0666)
				if err != nil {
					log.Fatal(err)
				}
				mw := io.MultiWriter(os.Stdout, logFile)
				log.SetOutput(mw)
			}

		},
		Run: func(cmd *cobra.Command, args []string) {

			// check if project is already initialized
			if pathExists(nhostDir) {
				log.Info("Nhost project detected in current directory")

				// start the "dev" command
				devCmd.Run(cmd, args)
			} else {

				// start the "init" command
				initCmd.Run(cmd, args)

				// configure interative prompt
				frontendPrompt := promptui.Prompt{
					Label:     "Do you want to setup a front-end project template",
					IsConfirm: true,
				}

				frontendApproval, _ := frontendPrompt.Run()

				if strings.ToLower(frontendApproval) == "y" || strings.ToLower(frontendApproval) == "yes" {

					templatesCmd.Run(cmd, args)

				}

				// start the "dev" command
				devCmd.Run(cmd, args)
			}

		},
	}
)

// Initialize common constants and variables used by multiple commands
// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {

	if err := rootCmd.Execute(); err != nil {
		log.Println(err)
		os.Exit(1)
	}

	// un-comment the following to auto-generate documentation
	//generateDocumentation()

}

// auto-generate utility documentation in all required formats
func generateDocumentation() {

	docsDir := path.Join(workingDir, "docs")

	// Generate Markdown docs
	err := doc.GenMarkdownTree(rootCmd, path.Join(docsDir, "markdown"))
	if err != nil {
		log.Fatal(err)
	}

	// Generate REST docs
	err = doc.GenReSTTree(rootCmd, path.Join(docsDir, "rest"))
	if err != nil {
		log.Fatal(err)
	}

	// Generate YAML docs
	err = doc.GenYamlTree(rootCmd, path.Join(docsDir, "yaml"))
	if err != nil {
		log.Fatal(err)
	}

	// Generate MAN pages
	header := &doc.GenManHeader{
		Title:   "MINE",
		Section: "3",
	}
	err = doc.GenManTree(rootCmd, header, path.Join(docsDir, "man"))
	if err != nil {
		log.Fatal(err)
	}

}

func init() {
	cobra.OnInitialize(initConfig)

	// Here you will define your flags and configuration settings.
	// Cobra supports persistent flags, which, if defined here,
	// will be global for your application.

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.nhost.yaml)")

	rootCmd.PersistentFlags().BoolVarP(&JSON, "json", "j", false, "Print JSON formatted logs")
	//rootCmd.PersistentFlags().StringVarP(&userLicense, "license", "l", "", "name of license for the project")
	//rootCmd.PersistentFlags().Bool("viper", true, "use Viper for configuration")
	//viper.BindPFlag("author", rootCmd.PersistentFlags().Lookup("author"))
	//viper.BindPFlag("useViper", rootCmd.PersistentFlags().Lookup("viper"))
	viper.SetDefault("author", "Mrinal Wahal mrinalwahal@gmail.com")
	viper.SetDefault("license", "MIT")

	//rootCmd.AddCommand(versionCmd)
	//rootCmd.AddCommand(initCmd)

	// Cobra also supports local flags, which will only run
	// when this action is called directly.
	rootCmd.PersistentFlags().StringVarP(&LOG_FILE, "log-file", "l", "", "Write logs to given file")
	rootCmd.PersistentFlags().BoolVarP(&DEBUG, "debug", "d", false, "Show debugging level logs")
}

func resetUmask() {

	// windows doesn't use umask for applying permissions,
	// so skip it for windows
	if runtime.GOOS == "darwin" || runtime.GOOS == "linux" {
		syscall.Umask(0)
	}
}

func getSavedProject() Project {

	var response Project

	nhostConfig, err := readYaml(path.Join(dotNhost, "nhost.yaml"))
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to read Nhost config")
	}

	user, _ := validateAuth(authPath)

	for _, project := range user.Projects {
		if project.ID == nhostConfig["project_id"] {
			response = project
			break
		}
	}

	return response
}

// if the required binary exists in $HOME/.nhost
// this function returns it's exact path
// and if the binary doesn't exist,
// it downloads it from specifically supplied URL
// based on user's OS and ARCH
func fetchBinary(binary string, version string) (string, error) {

	var url string

	// save binary specific URLs
	switch binary {
	case "hasura":
		url = fmt.Sprintf("https://github.com/hasura/graphql-engine/releases/download/%v/cli-hasura-%v-%v", version, runtime.GOOS, runtime.GOARCH)
	}

	if url == "" {
		return url, errors.New("binary not supported")
	}

	// initialize the binary path
	binaryPath := path.Join(NHOST_DIR, binary)

	// search for installed binary
	if pathExists(binaryPath) {
		return binaryPath, nil
	}

	// create the binary path
	out, err := os.Create(binaryPath)
	if err != nil {
		return "", err
	}

	defer out.Close()

	// update binary download URL depending upon the OS
	if runtime.GOOS == "windows" {
		url += ".exe"
	}

	log.WithField("component", fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)).Infof("Downloading %s binary", binary)

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	log.WithField("component", fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)).Debugf("Writing %s binary", binary)

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", err
	}

	// Change permissions so that the download file
	// can become accessible and executable
	err = os.Chmod(binaryPath, 0777)

	if err != nil {
		return "", err
	}

	//return the path at which binary has been
	// downloaded and saved
	return binaryPath, nil
}

/*
// Legacy method of loading binaries
// embedded directly into utility binary
func loadBinary(binary string, data []byte) (string, error) {

	//return path.Join("assets", binary), nil

	log.Debugf("Loading %s binary", binary)

	binaryPath := path.Join(dotNhost, binary)

	// search for installed binary
	if pathExists(binaryPath) {
		return binaryPath, nil
	}

	// if it doesn't exist, create it from embedded asset
	log.Debugf("%s binary doesn't exist, so creating it at: %s", binary, binaryPath)

	f, err := os.Create(binaryPath)
	if err != nil {
		log.Fatalf("Failed to instantiate binary path: %s", binary)
	}

	defer f.Close()

	//n, err := io.Copy(f, data)

	if _, err = f.Write(data); err != nil {
		log.Fatalf("Failed to create %s binary", binary)
	}
	f.Sync()

	// Change permissions
	err = os.Chmod(binaryPath, 0777)
	if err != nil {
		log.Fatalf("Failed to takeover %s binary permissions", binary)
	}

	log.Debugf("Created %s binary at %s%s%s", binary, Bold, binaryPath, Reset)

	return binaryPath, err
}

// validates whether the CLI utlity is installed or not
func verifyUtility(command string) bool {

	log.Debugf("Validating %s installation", command)

	cmd := exec.Command("command", "-v", command)
	return cmd.Run() != nil
}
*/

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

// deletes the given file/folder path and unlink from filesystem
func deletePath(path string) error {
	err := os.Remove(path)
	return err
}

// deletes all the paths leading to the given file/folder and unlink from filesystem
func deleteAllPaths(path string) error {
	err := os.RemoveAll(path)
	return err
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
