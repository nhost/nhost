//go:build windows
// +build windows

// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package getter

import (
	"fmt"
	"os"
	"path/filepath"
	"unsafe"

	"golang.org/x/sys/windows"
)

// resolveSymlinks resolves symlinks with special handling for Windows junction points in Go 1.23+.
// This function provides a more robust fallback for Windows path resolution issues.
func resolveSymlinks(src string) (string, error) {
	// On Windows, check for junction points FIRST since filepath.EvalSymlinks
	// does not properly resolve junction points - it only normalizes the path
	lstatInfo, lstatErr := os.Lstat(src)
	if lstatErr != nil {
		// Path doesn't exist or can't be accessed
		return "", lstatErr
	}

	// Case 1: Check if this is a junction point
	var isJunction bool
	var junctionErr error
	if isJunction, junctionErr = isWindowsJunctionPoint(src); junctionErr == nil && isJunction {
		// Confirmed junction point - resolve to actual target path
		target, resolveErr := resolveJunctionTarget(src)
		if resolveErr != nil {
			return "", fmt.Errorf("failed to resolve junction point target for %s: %w", src, resolveErr)
		}
		return filepath.Clean(target), nil
	}

	// Case 2: Not a junction point, try standard symlink resolution
	resolved, err := filepath.EvalSymlinks(src)
	if err == nil {
		return resolved, nil
	}

	statInfo, statErr := os.Stat(src)
	if statErr != nil {
		// Path can't be followed, return the original EvalSymlinks error
		return "", err
	}

	// Case 3: Check if this is a regular directory or file
	isRegularDir := lstatInfo.IsDir() && statInfo.IsDir() &&
		lstatInfo.Mode()&os.ModeIrregular == 0 &&
		lstatInfo.Mode()&os.ModeSymlink == 0

	if isRegularDir {
		// I'm just a dir, yes I'm only a dir,
		// EvalSymlinks tried but it stopped right here,
		// So do what EvalSymlinks would normally do:
		// Return the cleaned path, plain and true.
		return filepath.Clean(src), nil
	}

	// If we get here, it's some other type of special file/link that we don't understand
	// Return the original EvalSymlinks error
	if junctionErr != nil {
		return "", fmt.Errorf("failed to resolve symlinks (checking whether junction point: %s): %w", junctionErr, err)
	}
	return "", fmt.Errorf("failed to resolve symlinks: %w", err)
}

// isWindowsJunctionPoint uses Windows API to reliably detect junction points
// by checking the reparse point tag specifically.
func isWindowsJunctionPoint(path string) (bool, error) {
	// Convert path to UTF16 for Windows API
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return false, err
	}

	// Get file attributes to check if it's a reparse point
	attrs := windows.Win32FileAttributeData{}
	err = windows.GetFileAttributesEx(
		pathPtr,
		windows.GetFileExInfoStandard,
		(*byte)(unsafe.Pointer(&attrs)),
	)
	if err != nil {
		return false, err
	}

	// Check if this is a reparse point
	if attrs.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT == 0 {
		return false, nil
	}

	// Open the file to get reparse point information
	handle, err := windows.CreateFile(
		pathPtr,
		0, // No access needed, just query reparse data
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT,
		0,
	)
	if err != nil {
		return false, err
	}
	defer windows.CloseHandle(handle)

	// Query the reparse point data
	const FSCTL_GET_REPARSE_POINT = 0x900a8
	const MAXIMUM_REPARSE_DATA_BUFFER_SIZE = 16 * 1024

	buffer := make([]byte, MAXIMUM_REPARSE_DATA_BUFFER_SIZE)
	var bytesReturned uint32

	err = windows.DeviceIoControl(
		handle,
		FSCTL_GET_REPARSE_POINT,
		nil,
		0,
		&buffer[0],
		uint32(len(buffer)),
		&bytesReturned,
		nil,
	)
	if err != nil {
		return false, err
	}

	// Parse the reparse tag from the buffer
	// The reparse tag is the first 4 bytes of the reparse data buffer
	if bytesReturned < 4 {
		return false, nil
	}

	reparseTag := *(*uint32)(unsafe.Pointer(&buffer[0]))

	// IO_REPARSE_TAG_MOUNT_POINT indicates a junction point
	const IO_REPARSE_TAG_MOUNT_POINT = 0xA0000003
	// IO_REPARSE_TAG_SYMLINK indicates a symbolic link
	const IO_REPARSE_TAG_SYMLINK = 0xA000000C

	isJunction := reparseTag == IO_REPARSE_TAG_MOUNT_POINT
	return isJunction, nil
}

// resolveJunctionTarget reads the actual target path from a Windows junction point
func resolveJunctionTarget(path string) (string, error) {
	// Convert path to UTF16 for Windows API
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return "", err
	}

	// Open the file to get reparse point information
	handle, err := windows.CreateFile(
		pathPtr,
		0, // No access needed, just query reparse data
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT,
		0,
	)
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(handle)

	// Query the reparse point data
	const FSCTL_GET_REPARSE_POINT = 0x900a8
	const MAXIMUM_REPARSE_DATA_BUFFER_SIZE = 16 * 1024

	buffer := make([]byte, MAXIMUM_REPARSE_DATA_BUFFER_SIZE)
	var bytesReturned uint32

	err = windows.DeviceIoControl(
		handle,
		FSCTL_GET_REPARSE_POINT,
		nil,
		0,
		&buffer[0],
		uint32(len(buffer)),
		&bytesReturned,
		nil,
	)
	if err != nil {
		return "", err
	}

	// Parse the reparse point data to extract target path
	// The structure is:
	// DWORD ReparseTag
	// WORD ReparseDataLength
	// WORD Reserved
	// WORD SubstituteNameOffset
	// WORD SubstituteNameLength
	// WORD PrintNameOffset
	// WORD PrintNameLength
	// WCHAR PathBuffer[1] (variable length)

	if bytesReturned < 16 {
		return "", fmt.Errorf("reparse data too short: %d bytes", bytesReturned)
	}

	// Skip the header (8 bytes: ReparseTag + ReparseDataLength + Reserved)
	dataStart := 8

	// Read the path offsets and lengths
	substituteNameOffset := *(*uint16)(unsafe.Pointer(&buffer[dataStart]))
	substituteNameLength := *(*uint16)(unsafe.Pointer(&buffer[dataStart+2]))
	// printNameOffset := *(*uint16)(unsafe.Pointer(&buffer[dataStart+4]))  // Not used, substitute name is preferred
	// printNameLength := *(*uint16)(unsafe.Pointer(&buffer[dataStart+6]))  // Not used, substitute name is preferred

	// Path buffer starts after the offset/length fields (8 more bytes)
	pathBufferStart := dataStart + 8

	// Use the substitute name (which contains the actual target path)
	targetStart := pathBufferStart + int(substituteNameOffset)
	targetEnd := targetStart + int(substituteNameLength)

	if targetEnd > int(bytesReturned) {
		return "", fmt.Errorf("invalid reparse data: target path extends beyond buffer")
	}

	// Convert UTF-16 bytes to string
	targetBytes := buffer[targetStart:targetEnd]
	if len(targetBytes)%2 != 0 {
		return "", fmt.Errorf("invalid UTF-16 data: odd number of bytes")
	}

	// Convert bytes to uint16 slice for UTF-16 decoding
	utf16Data := make([]uint16, len(targetBytes)/2)
	for i := 0; i < len(utf16Data); i++ {
		utf16Data[i] = *(*uint16)(unsafe.Pointer(&targetBytes[i*2]))
	}

	// Convert UTF-16 to string
	target := windows.UTF16ToString(utf16Data)

	// Remove Windows NT namespace prefixes if present
	if len(target) >= 4 && target[:4] == `\??\` {
		target = target[4:]
	}

	return target, nil
}
