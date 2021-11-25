package tests

import (
	"io/ioutil"

	"github.com/nhost/cli/cmd"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

//  Initialize all the commands
var (
	rootCmd = cmd.NewRootCmd()
	initCmd = cmd.NewInitCmd()
	devCmd  = cmd.NewDevCmd()

	//	Create temporary directory for testing
	path, _ = ioutil.TempDir("", "nhost-test")

	log = &logger.Log
)

func Init() {
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(devCmd)
	logger.DEBUG = true
	path, _ = ioutil.TempDir("", "nhost-test")
	util.Init(util.Config{
		WorkingDir: path,
	})
	rootCmd.Flag("path").Value.Set(path)
	nhost.HOME, _ = ioutil.TempDir("", "nhost-home")
	nhost.Init()
}
