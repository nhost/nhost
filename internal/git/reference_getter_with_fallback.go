package git

import (
	"github.com/nhost/cli/util"
	"os"
	"path/filepath"
)

const (
	defaultGitBranch = "main"
)

// NewReferenceGetterWithFallback returns a reference getter that first tries to get the reference from the git folder
func NewReferenceGetterWithFallback() (ReferenceGetter, error) {
	gitPath, err := gitFolderLookup()
	if err != nil {
		return nil, err
	}

	if gitPath == "" {
		return noGitReferenceGetter{}, nil
	}

	return NewClient(gitPath)
}

type noGitReferenceGetter struct{}

func (r noGitReferenceGetter) RefName() (string, error) {
	return defaultGitBranch, nil
}

// gitFolderLookup returns the path to the .git folder or an empty string if it doesn't exist
func gitFolderLookup() (string, error) {
	path, err := os.Getwd()
	if err != nil {
		return "", err
	}

	// needed to find the .git folder in case the current working directory is a subfolder (f.e. in monorepo) of the git repository
	for {
		gitPath := path + "/.git"
		if util.PathExists(gitPath) {
			return gitPath, nil
		}

		// If we are at the root, stop looking
		if path == "/" {
			return "", nil
		}

		// go up one level
		path = filepath.Clean(filepath.Join(path, ".."))
	}
}
