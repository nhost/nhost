package cmd

import (
	"bytes"
	"context"
	"io/ioutil"
	"os"
	"os/exec"

	client "github.com/docker/docker/client"
	"github.com/fsnotify/fsnotify"
	"github.com/go-git/go-git/v5"
	"github.com/hashicorp/go-getter"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// download a remote directory/file to local
func clone(src, dest string) error {

	// initialize hashicorp go-getter client
	client := &getter.Client{
		Ctx: context.Background(),
		//define the destination to where the directory will be stored. This will create the directory if it doesnt exist
		Dst:  dest,
		Dir:  true,
		Src:  src,
		Mode: getter.ClientModeDir,
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

func pullImage(cli *client.Client, tag string) error {

	log.WithField("component", tag).Info("Pulling container image")

	/*
		out, err := cli.ImagePull(context.Background(), tag, types.ImagePullConfiguration{})
		out.Close()
	*/

	dockerCLI, _ := exec.LookPath("docker")
	cmd := exec.Cmd{
		Args:   []string{dockerCLI, "image", "pull", tag},
		Path:   dockerCLI,
		Stdout: os.Stdout,
	}
	return cmd.Run()
}

func loadRepository() (*git.Repository, error) {

	log.Debug("Loading local git repository")
	return git.PlainOpen(nhost.WORKING_DIR)
}

func getCurrentBranch(repo *git.Repository) string {
	head, err := repo.Head()
	if err != nil {
		return ""
	}

	if head.Name().IsBranch() {
		return head.Name().Short()
	}

	return ""
}

// Infinite function which listens for
// fsnotify events once launched
func (e *Environment) Watch(watcher *fsnotify.Watcher, cmd *cobra.Command, args []string) {
	for {
		select {
		// detect Ctrl + C
		case <-stop:
			log.WithField("component", "watcher").Debug("Inactivated")
			return
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Write == fsnotify.Write ||
				event.Op&fsnotify.Create == fsnotify.Create {

				// run the operation
				if err := e.Watchers[event.Name](cmd, args); err != nil {
					log.WithField("component", "watcher").Error(err)
				}

			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.WithField("component", "watcher").Debug(err)
		}
	}
}
