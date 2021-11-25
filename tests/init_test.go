package tests

import (
	"os"
	"testing"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
)

func TestInitLocations(t *testing.T) {
	tests := []struct {
		name      string
		wantErr   bool
		operation func() error
	}{
		{
			name:      "required paths",
			wantErr:   false,
			operation: pathsCreated,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := nhost.InitLocations(); (err != nil) != tt.wantErr {
				t.Errorf("InitLocations() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}

	//	Cleanup
	deletePaths()

}

func TestNewInitCmd(t *testing.T) {

	os.Args = append(os.Args, "init")

	//	Bypass confirmation prompt
	initCmd.Flag("yes").Value.Set("true")

	tests := []struct {
		name      string
		want      error
		operation func() error
	}{
		{
			name:      "required paths",
			want:      nil,
			operation: pathsCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := initCmd.Execute(); got != tt.want {
				t.Errorf("error = %v", got)
			}
		})
	}

	//	Cleanup
	deletePaths()
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
