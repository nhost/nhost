// +build linux,386 linux,amd64 windows,386 windows,amd64 darwin,amd64 darwin,arm64

package util

import "syscall"

//	Detects whether the host machine is running on Apple Silicon processor.
func RunningSilicon() bool {

	r, err := syscall.Sysctl("sysctl.proc_translated")
	if err != nil {
		if err.Error() == "no such file or directory" {
			return false
		}
	}

	return r == "\x00\x00\x00" || r == "\x01\x00\x00"
}
