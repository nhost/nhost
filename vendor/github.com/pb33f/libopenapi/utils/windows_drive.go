package utils

import (
	"path/filepath"
	"strings"
)

func ReplaceWindowsDriveWithLinuxPath(path string) string {
	if len(path) > 1 && path[1] == ':' {
		path = strings.ReplaceAll(path, "\\", "/")
		return path[2:]
	}
	return strings.ReplaceAll(path, "\\", "/")
}

func CheckPathOverlap(pathA, pathB, sep string) string {
	a := strings.Split(pathA, sep)
	b := strings.Split(pathB, sep)
	if strings.HasPrefix(a[len(a)-1], "/") && a[len(a)-1][1:] == b[0] {
		b = b[1:]
	}
	if a[len(a)-1] == b[0] {
		b = b[1:]
	}
	f := filepath.Join(pathA, strings.Join(b, sep))

	return f
}
