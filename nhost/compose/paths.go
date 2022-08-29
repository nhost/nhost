package compose

import "path/filepath"

const (
	// data directory names
	dataDir        = "data"
	dataDirDb      = "db"
	dataDirPgdata  = "pgdata"
	dataDirMailhog = "mailhog"
	dataDirMinio   = "minio"
	// --
)

func dataDirGitBranchScopedPath(gitBranch, path string) string {
	return filepath.Join(dataDir, gitBranch, path)
}

func MinioDataDirGitBranchScopedPath(gitBranch string) string {
	return dataDirGitBranchScopedPath(gitBranch, dataDirMinio)
}

func MailHogDataDirGiBranchScopedPath(gitBranch string) string {
	return dataDirGitBranchScopedPath(gitBranch, dataDirMailhog)
}

func DbDataDirGitBranchScopedPath(gitBranch, path string) string {
	return dataDirGitBranchScopedPath(gitBranch, filepath.Join(dataDirDb, path))
}
