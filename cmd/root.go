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
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/mattn/go-colorable"
	"github.com/mrinalwahal/cli/formatter"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/cobra/doc"
	"github.com/spf13/viper"
)

var (

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
  `,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {

			// reset the umask before creating directories anywhere in this program
			// otherwise applied permissions, might get affected
			// resetUmask()

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
			if pathExists(nhost.NHOST_DIR) {

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
	// generateDocumentation()

}

// auto-generate utility documentation in all required formats
func generateDocumentation() {

	docsDir := path.Join(nhost.WORKING_DIR, "docs")

	// Generate Markdown docs
	err := doc.GenMarkdownTree(rootCmd, docsDir)
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

/*
func resetUmask() {

	// windows doesn't use umask for applying permissions,
	// so skip it for windows
	if runtime.GOOS != "windows" {
		syscall.Umask(0)
	}
}
*/

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

// deletes the given file/folder path and unlink from filesystem
func deletePath(path string) error {
	os.Chmod(path, 0777)
	return os.Remove(path)
}

// moves the given file/folder path to new location
func movePath(source, destination string) error {
	return os.Rename(source, destination)
}

// deletes all the paths leading to the given file/folder and unlink from filesystem
func deleteAllPaths(path string) error {
	os.Chmod(path, 0777)
	return os.RemoveAll(path)
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

func replaceInFile(filePath, search_string, replacement string) error {

	// open and read the contents of the file
	f, err := ioutil.ReadFile(filePath)
	if err != nil {
		return err
	}

	data := strings.ReplaceAll(string(f), search_string, replacement)

	var buffer bytes.Buffer

	buffer.WriteString(data)

	// write the data to the file
	err = ioutil.WriteFile(filePath, buffer.Bytes(), 0644)
	return err
}

func replaceInFileWithRegex(filePath, replacement string, expression *regexp.Regexp, indices []int) error {

	// open and read the contents of the file
	f, err := ioutil.ReadFile(filePath)
	if err != nil {
		return err
	}

	var buffer bytes.Buffer

	results := expression.FindAllStringSubmatch(string(f), -1)

	data := string(f)

	for _, result := range results {

		var values []interface{}

		for _, index := range indices {
			values = append(values, result[index])
		}

		data = strings.ReplaceAll(data, result[0], fmt.Sprintf(replacement, values...))
	}

	buffer.WriteString(data)

	// write the data to the file
	err = ioutil.WriteFile(filePath, buffer.Bytes(), 0644)
	return err
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {

		// Search config in home directory with name ".nhost" (without extension).
		viper.AddConfigPath(nhost.HOME)
		viper.SetConfigName(".nhost")
	}

	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		log.Println("using config file:", viper.ConfigFileUsed())
	}
}
