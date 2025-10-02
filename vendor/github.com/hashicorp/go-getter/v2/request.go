package getter

import (
	"io"
	"net/url"
	"os"
)

type Request struct {
	// Src is the source URL to get.
	//
	// Dst is the path to save the downloaded thing as. If Dir is set to
	// true, then this should be a directory. If the directory doesn't exist,
	// it will be created for you.
	//
	// Pwd is the working directory for detection. If this isn't set, some
	// detection may fail. Client will not default pwd to the current
	// working directory for security reasons.
	Src string
	Dst string
	Pwd string

	// Forced is the forced getter detected in the Src string during the
	// Getter detection. Forcing a getter means that go-getter will try
	// to download the artifact only with the Getter that is being forced.
	//
	// For example:
	//
	// Request.Src                                          Forced
	// git::ssh://git@git.example.com:2222/foo/bar.git      git
	//
	// This field is used by the Getters to validate when they are forced to download
	// the artifact.
	// If both Request.Src and Forced contains a forced getter, the one in the Request.Src will
	// be considered and will override the value of this field.
	Forced string

	// Umask is used to mask file permissions when storing local files or
	// decompressing an archive
	Umask os.FileMode

	// GetMode is the method of download the client will use. See Mode for
	// documentation.
	GetMode Mode

	// Copy, in local file mode if set to true, will copy data instead of using
	// a symlink. If false, attempts to symlink to speed up the operation and
	// to lower the disk space usage. If the symlink fails, may attempt to copy
	// on windows.
	Copy bool

	// Inplace, in local file mode if set to true, do nothing and the returned
	// operation will simply contain the source file path. Inplace has precedence
	// over Copy.
	Inplace bool

	// ProgressListener allows to track file downloads.
	// By default a no op progress listener is used.
	ProgressListener ProgressTracker

	// Disable symlinks is used to prevent copying or writing files through symlinks.
	// When set to true any copying or writing through symlinks will result in a ErrSymlinkCopy error.
	DisableSymlinks bool

	u               *url.URL
	subDir, realDst string
}

func (req *Request) URL() *url.URL {
	return req.u
}

// umask returns the effective umask for the Request, defaulting to the process
// umask
func (req *Request) umask() os.FileMode {
	if req == nil {
		return 0
	}
	return req.Umask
}

func (req *Request) CopyReader(dst string, src io.Reader, fmode os.FileMode, fileSizeLimit int64) error {
	return copyReader(dst, src, fmode, req.Umask, fileSizeLimit)
}

// Mode returns file Mode umasked by the Request umask
func (req *Request) Mode(m os.FileMode) os.FileMode {
	return mode(m, req.umask())
}

// mode returns the file mode masked by the umask
func mode(mode, umask os.FileMode) os.FileMode {
	return mode & ^umask
}
