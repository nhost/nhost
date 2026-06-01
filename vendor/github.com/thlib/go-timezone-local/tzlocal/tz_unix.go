//go:build !windows
// +build !windows

package tzlocal

import (
	"fmt"
	"os"
	"path"
)

const localZoneFile = "/etc/localtime" // symlinked file - set by OS

func inferFromPath(p string) (string, error) {
	var name string
	var err error
	dir, lname := path.Split(p)

	if len(dir) == 0 || len(lname) == 0 {
		err = fmt.Errorf("cannot infer timezone name from path: %q", p)
		return name, err
	}

	_, fname := path.Split(dir[:len(dir)-1])

	if fname == "zoneinfo" {
		name = lname // e.g. /usr/share/zoneinfo/Japan
	} else {
		name = fname + string(os.PathSeparator) + lname // e.g. /usr/share/zoneinfo/Asia/Tokyo
	}

	return name, err
}

// LocalTZ will run `/etc/localtime` and get the timezone from the resulting value `/usr/share/zoneinfo/America/New_York`
func LocalTZ() (string, error) {
	var name string
	fi, err := os.Lstat(localZoneFile)
	if err != nil {
		err = fmt.Errorf("failed to stat %q: %w", localZoneFile, err)
		return name, err
	}

	if (fi.Mode() & os.ModeSymlink) == 0 {
		err = fmt.Errorf("%q is not a symlink - cannot infer name", localZoneFile)
		return name, err
	}

	p, err := os.Readlink(localZoneFile)
	if err != nil {
		return name, err
	}

	// handles 1 & 2 part zone names
	name, err = inferFromPath(p)
	return name, err
}
