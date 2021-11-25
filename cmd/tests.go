package cmd

import (
	"io/ioutil"
	"testing"

	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

func InitTests() {

	//	Create temporary directory for testing
	path, _ := ioutil.TempDir("", "nhost")
	rootCmd.Flag("path").Value.Set(path)

	logger.DEBUG = true
	home, _ := ioutil.TempDir("", "home")
	nhost.UpdateLocations(util.WORKING_DIR, path)
	util.WORKING_DIR = path

	nhost.UpdateLocations(nhost.HOME, home)
	nhost.HOME = home
}

type test struct {
	name      string
	wantErr   bool
	err       error
	validator func() error
	prerun    func()
	operation func() error
	postrun   func()
}

func (tt *test) run(t *testing.T) {

	t.Run(tt.name, func(t *testing.T) {

		//	Pre-run
		tt.prerun()

		if got := tt.operation(); (got != nil) != tt.wantErr {
			t.Errorf("error = %v", got)
		}

		if err := tt.validator(); (err != nil) != tt.wantErr {
			t.Errorf("operation() error = %v", err)
		}
	})
}
