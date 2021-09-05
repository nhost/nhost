package cmd

import (
	"bytes"
	"io/ioutil"
	"os"
)

// check whether source array contains value or not
func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

// deletes the given file/folder path and unlink from filesystem
func deletePath(path string) error {
	os.Chmod(path, 0777)
	return os.Remove(path)
}

// moves the given file/folder path to new location
func movePath(source, destination string) error {
	return os.Rename(source, destination)
}

// deletes all the paths leading to the given file/folder and unlink from filesystem
func deleteAllPaths(path string) error {
	os.Chmod(path, 0777)
	return os.RemoveAll(path)
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
