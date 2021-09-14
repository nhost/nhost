package functions

import (
	"path/filepath"
	"strings"
)

func remove(s []Function, i int) []Function {
	s[i] = s[len(s)-1]
	return s[:len(s)-1]
}

func fileNameWithoutExtension(fileName string) string {
	return strings.TrimSuffix(fileName, filepath.Ext(fileName))
}
