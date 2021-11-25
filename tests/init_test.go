package tests

import (
	"os"
	"testing"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

func TestLocations(t *testing.T) {

	tests := tests{
		{
			name:      "required paths available",
			wantErr:   false,
			operation: nhost.InitLocations,
			validator: pathsCreated,
		},
		{
			name:      "required paths unavailable",
			wantErr:   true,
			operation: nhost.InitLocations,
			validator: func() error {
				deletePaths()
				return pathsCreated()
			},
		},
	}

	//	Run tests
	run(tests, t)

	//	Cleanup
	deletePaths()
}

func TestNewInitCmd(t *testing.T) {

	tests := tests{newLocalAppTest}

	//	Run tests
	run(tests, t)

	//	Cleanup
	deletePaths()
}

var newLocalAppTest = test{
	name:    "new_local_app",
	err:     nil,
	wantErr: false,
	prerun: func() {

		os.Args = append(os.Args, "init")

		//	Add test app name
		initCmd.Flag("name").Value.Set("test")

	},
	validator: pathsCreated,
	operation: initCmd.Execute,
}

func pathsCreated() error {

	//	Ensure all required directories are created successfully
	for _, item := range nhost.LOCATIONS.Directories {
		if _, err := os.Stat(*item); os.IsNotExist(err) {
			return err
		}
	}

	//	Ensure all required files are created successfully
	for _, item := range nhost.LOCATIONS.Files {
		if _, err := os.Stat(*item); os.IsNotExist(err) {
			return err
		}
	}

	return nil
}

func deletePaths() error {

	//	Delete all created directories
	for _, item := range nhost.LOCATIONS.Directories {
		util.DeleteAllPaths(*item)
	}

	//	Delete all created files
	for _, item := range nhost.LOCATIONS.Files {
		util.DeleteAllPaths(*item)
	}

	return nil
}
