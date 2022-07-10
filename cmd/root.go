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
	"github.com/docker/docker/pkg/namesgenerator"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
	"github.com/spf13/cobra/doc"
	"github.com/spf13/viper"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	ErrNotLoggedIn = "Please login with `nhost login`"
	ErrLoggedIn    = "You are already logged in, first logout with `nhost logout`"
)

var (
	Version string
	cfgFile string
	status  = &util.Writer
	log     = &logger.Log
	//  rootCmd represents the base command when called without any subcommands
	rootCmd = &cobra.Command{
		Use:   "nhost",
		Short: "Nhost: The Open Source Firebase Alternative with GraphQL",
		Long: fmt.Sprintf(`
      _   ____               __
     / | / / /_  ____  _____/ /_
    /  |/ / __ \/ __ \/ ___/ __/
   / /|  / / / / /_/ (__  ) /_
  /_/ |_/_/ /_/\____/____/\__/


  Nhost: The Open Source Firebase Alternative with GraphQL.
  Version - %s
  Documentation - https://docs.nhost.io
  `, Version),
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {

			//  reset the umask before creating directories anywhere in this program
			//  otherwise applied permissions, might get affected
			//  resetUmask()

			logger.Init()
			util.Init(util.Config{Writer: status})
			nhost.Init()

			if !util.PathExists(filepath.Join(util.WORKING_DIR, ".nhost/project_name")) {
				rand.Seed(time.Now().UnixNano())
				randomName := strings.Join([]string{filepath.Base(util.WORKING_DIR), namesgenerator.GetRandomName(0)}, "-")
				if err := nhost.SetDockerComposeProjectName(randomName); err != nil {
					status.Errorln("Failed to set project name")
					return err
				}
			}

			return nil
		},
	}
)

//  Initialize common constants and variables used by multiple commands
//  Execute adds all child commands to the root command and sets flags appropriately.
//  This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {

	if err := rootCmd.Execute(); err != nil {
		log.Fatal(err)
	}

	//  un-comment the following to auto-generate documentation
	//	generateDocumentation()

}

//  auto-generate utility documentation in all required formats
func generateDocumentation() {

	docsDir := filepath.Join(util.WORKING_DIR, "docs")

	//  Generate Markdown docs
	err := doc.GenMarkdownTree(rootCmd, docsDir)
	if err != nil {
		log.Fatal(err)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	//  Here you will define your flags and configuration settings.
	//  Cobra supports persistent flags, which, if defined here,
	//  will be global for your application.

	//	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.nhost.yaml)")

	rootCmd.PersistentFlags().BoolVarP(&logger.JSON, "json", "j", false, "Print JSON formatted logs")
	rootCmd.PersistentFlags().StringVar(&nhost.DOMAIN, "domain", "nhost.run", "Auth domain - for internal testing")
	//rootCmd.PersistentFlags().StringVarP(&userLicense, "license", "l", "", "name of license for the project")
	//rootCmd.PersistentFlags().Bool("viper", true, "use Viper for configuration")
	//viper.BindPFlag("author", rootCmd.PersistentFlags().Lookup("author"))
	//viper.BindPFlag("useViper", rootCmd.PersistentFlags().Lookup("viper"))
	viper.SetDefault("author", "Mrinal Wahal wahal@nhost.io")
	viper.SetDefault("license", "MIT")

	//rootCmd.AddCommand(versionCmd)
	//rootCmd.AddCommand(initCmd)

	//  Cobra also supports local flags, which will only run
	//  when this action is called directly.
	rootCmd.PersistentFlags().BoolVarP(&logger.DEBUG, "debug", "d", false, "Show debugging level logs")

	path, _ := os.Getwd()
	rootCmd.PersistentFlags().StringVar(&path, "path", path, "Current working directory to execute CLI in")
}

/*
func resetUmask() {

	//  windows doesn't use umask for applying permissions,
	//  so skip it for windows
	if runtime.GOOS != "windows" {
		syscall.Umask(0)
	}
}
*/

//  initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		//  Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {

		//  Search config in home directory with name ".nhost" (without extension).
		viper.AddConfigPath(nhost.HOME)
		viper.SetConfigName(".nhost")
	}

	viper.AutomaticEnv() //  read in environment variables that match

	//  If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		log.Println("using config file:", viper.ConfigFileUsed())
	}
}
