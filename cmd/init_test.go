package cmd

import (
	"os"
	"testing"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

func TestLocations(t *testing.T) {

	InitTests()

	tests := []test{
		{
			name:      "required paths available",
			wantErr:   false,
			operation: nhost.InitLocations,
			validator: pathsCreated,
			postrun:   deletePaths,
		},
		{
			name:      "required paths unavailable",
			wantErr:   true,
			operation: nhost.InitLocations,
			validator: func() error {
				deletePaths()
				return pathsCreated()
			},
			postrun: deletePaths,
		},
	}

	//	Run tests
	for _, tt := range tests {
		tt.run(t)
	}
}

func TestNewInitCmd(t *testing.T) {

	InitTests()

	tests := []test{newLocalAppTest}

	//	Run tests
	for _, tt := range tests {
		tt.run(t)
	}

	//	Cleanup
	deletePaths()
}

var newLocalAppTest = test{
	name:    "new_local_app",
	err:     nil,
	wantErr: false,
	prerun: func() error {

		os.Args = append(os.Args, "init")

		//	Add test app name
		initCmd.Flag("name").Value.Set("test")

		return nil
	},
	validator: pathsCreated,
	operation: initCmd.Execute,
}

var newRemoteAppTest = test{
	name:    "new_remote_app",
	err:     nil,
	wantErr: false,
	prerun: func() error {

		os.Args = append(os.Args, "init")

		//	Add test app name
		initCmd.Flag("name").Value.Set("test")

		return nil
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
