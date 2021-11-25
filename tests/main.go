package tests

import (
	"io/ioutil"
	"testing"

	"github.com/nhost/cli/cmd"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

//  Initialize all the commands
var (
	initCmd = cmd.NewInitCmd()
	devCmd  = cmd.NewDevCmd()

	//	Create temporary directory for testing
	path, _ = ioutil.TempDir("", "nhost")
)

func Init() {
	logger.DEBUG = true
	nhost.HOME, _ = ioutil.TempDir("", "home")
	util.WORKING_DIR = path
	nhost.Init()
}

type test struct {
	name      string
	wantErr   bool
	err       error
	validator func() error
	prerun    func()
	operation func() error
}

type tests []test

func run(tests tests, t *testing.T) {

	//  Initialize runtime variables
	Init()

	for _, tt := range tests {
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
}
