//go:build !windows
// +build !windows

// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package getter

import (
	"path/filepath"
)

// resolveSymlinks resolves symlinks
func resolveSymlinks(src string) (string, error) {
	resolved, err := filepath.EvalSymlinks(src)
	if err != nil {
		return "", err
	}
	return resolved, nil
}

// isWindowsJunctionPoint is a no-op on non-Windows platforms
func isWindowsJunctionPoint(_ string) (bool, error) {
	return false, nil
}
