// +build darwin

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
