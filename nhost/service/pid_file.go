package service

import (
	"fmt"
	"github.com/nhost/cli/util"
	"os"
	"strconv"
)

type pidFile struct {
	path string
}

func newPidFile(path string) *pidFile {
	return &pidFile{
		path: path,
	}
}

func (p pidFile) Create() error {
	if p.exists() {
		return fmt.Errorf("pid file already exists, please run first 'nhost down': %s", p.path)
	}

	return os.WriteFile(p.path, []byte(strconv.Itoa(os.Getpid())), 0600)
}

func (p pidFile) Remove() error {
	return os.Remove(p.path)
}

func (p pidFile) exists() bool {
	return util.PathExists(p.path)
}
