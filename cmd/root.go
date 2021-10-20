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
	"fmt"
	"path/filepath"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/logger"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/mrinalwahal/cli/util"
	"github.com/spf13/cobra"
	"github.com/spf13/cobra/doc"
	"github.com/spf13/viper"
)

var (

	// rootCmd represents the base command when called without any subcommands
	rootCmd = &cobra.Command{
		Use:   "nhost",
		Short: "Open Source Firebase Alternative with GraphQL",
		Long: fmt.Sprintf(`
		_   ____               __ 
		/ | / / /_  ____  _____/ /_
	   /  |/ / __ \/ __ \/ ___/ __/
	  / /|  / / / / /_/ (__  ) /_  
	 /_/ |_/_/ /_/\____/____/\__/  
								   
	 
  Nhost.io is a full-fledged serverless backend for Jamstack and client-serverless applications.
  Version - %s
  Documentation - https://docs.nhost.io
  `, Version),
		PersistentPreRun: func(cmd *cobra.Command, args []string) {

			// reset the umask before creating directories anywhere in this program
			// otherwise applied permissions, might get affected
			// resetUmask()

			logger.Init()
		},
		Run: func(cmd *cobra.Command, args []string) {

			// check if project is already initialized
			if util.PathExists(nhost.NHOST_DIR) {

				// start the "dev" command
				devCmd.Run(cmd, args)

			} else {

				// start the "init" command
				initCmd.Run(cmd, args)

				// offer to clone templates
				// templatesCmd.Run(cmd, args)
				for _, item := range entities {
					if !item.Default {
						prompt := promptui.Prompt{
							Label:     fmt.Sprintf("Do you want to install %s templates", item.Name),
							IsConfirm: true,
						}

						_, err := prompt.Run()
						if err != nil {
							continue
						}

						selected = item

						// start the "templates" command
						templatesCmd.Run(cmd, args)

						//	reset selected template choice
						choice = ""
					}
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
		log.Fatal(err)
	}

	// un-comment the following to auto-generate documentation
	// generateDocumentation()

}

// auto-generate utility documentation in all required formats
func generateDocumentation() {

	docsDir := filepath.Join(nhost.WORKING_DIR, "docs")

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

	rootCmd.PersistentFlags().BoolVarP(&logger.JSON, "json", "j", false, "Print JSON formatted logs")
	rootCmd.PersistentFlags().StringVar(&nhost.API, "endpoint", "https://nuno.nhost.dev/v1/functions", "Auth endpoint - for internal testing")
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
	rootCmd.PersistentFlags().StringVarP(&logger.LOG_FILE, "log-file", "f", "", "Write logs to given file")
	rootCmd.PersistentFlags().BoolVarP(&logger.DEBUG, "debug", "d", false, "Show debugging level logs")
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
