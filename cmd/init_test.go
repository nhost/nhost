package cmd

import (
	"errors"
	"io/ioutil"
	"os"
	"testing"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"gopkg.in/yaml.v2"
)

func TestInit(t *testing.T) {

	InitTests(t)

	tests := []test{
		newLocalAppTest,
	}

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
	validator: func() error {

		//	Ensure all required locations are created successfully
		if err := pathsCreated(); err != nil {
			return err
		}

		//  Ensure default templates are cloned successfully
		emailFiles, err := os.ReadDir(nhost.EMAILS_DIR)
		if err != nil {
			return err
		}

		if len(emailFiles) == 0 {
			return errors.New("email templates not cloned successfully")
		}

		//  Ensure config.yaml is created successfully
		if _, err := os.Stat(nhost.CONFIG_PATH); os.IsNotExist(err) {
			return errors.New("config.yaml not saved successfully")
		}

		//  Ensure config.yaml can be usccessfully parsed
		var parsed nhost.Configuration

		data, err := ioutil.ReadFile(nhost.CONFIG_PATH)
		if err != nil {
			return err
		}

		if err = yaml.Unmarshal(data, &parsed); err != nil {
			return err
		}

		/*
			//  Ensure config.yaml has the correct values
			defaultConfig := nhost.GenerateConfig(nhost.App{})

			// remove SMTP port to avoid incorrect comparison
			parsed.Auth["smtp"].(map[interface{}]interface{})["port"] = ""
			defaultConfig.Auth["smtp"].(map[interface{}]interface{})["port"] = ""

			if !reflect.DeepEqual(parsed, defaultConfig) {
				return errors.New("config.yaml has incorrect values")
			}
		*/

		return nil
	},
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

var requiredPathsAvailable = test{
	name:      "required paths available",
	wantErr:   false,
	operation: nhost.InitLocations,
	validator: pathsCreated,
	postrun:   deletePaths,
}

var requiredPathsNotAvailable = test{
	name:      "required paths unavailable",
	wantErr:   true,
	operation: nhost.InitLocations,
	validator: func() error {
		deletePaths()
		return pathsCreated()
	},
	postrun: deletePaths,
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
