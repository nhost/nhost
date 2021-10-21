package cmd

import (
	"bytes"
	"io/ioutil"

	"github.com/hashicorp/go-getter"
	"github.com/nhost/cli-go/nhost"
)

// download a remote directory/file to local
func clone(src, dest string) error {

	// initialize hashicorp go-getter client
	client := &getter.Client{
		Ctx: env.Context,
		//define the destination to where the directory will be stored. This will create the directory if it doesnt exist
		Dst:  dest,
		Src:  src,
		Pwd:  nhost.WORKING_DIR,
		Mode: getter.ClientModeAny,
		//define the type of detectors go getter should use, in this case only github is needed
		Detectors: []getter.Detector{
			&getter.GitHubDetector{},
		},
	}

	return client.Get()
}

// check whether source array contains value or not
func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
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
