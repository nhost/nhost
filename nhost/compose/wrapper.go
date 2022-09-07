package compose

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/pkg/errors"
)

type DataStreams struct {
	Stdout io.Writer
	Stderr io.Writer
}

type Wrapper struct {
	workdir            string
	composeProjectName string
}

func InitWrapper(workdir, gitBranch string, conf *Config) (*Wrapper, error) {
	w := &Wrapper{
		workdir:            workdir,
		composeProjectName: conf.composeProjectName,
	}

	if err := w.init(workdir, gitBranch, conf); err != nil {
		return nil, err
	}

	return w, nil
}

func (w Wrapper) init(workdir, gitBranch string, conf *Config) error {
	if err := w.ensureFoldersExistForDockerVolumes(workdir, gitBranch); err != nil {
		return err
	}

	jsonConf, err := conf.BuildJSON()

	// write data to a docker-compose.yml file
	err = os.WriteFile(w.dockerComposePath(), jsonConf, 0600)
	if err != nil {
		return errors.Wrap(err, "could not write docker-compose.yml file")
	}

	return nil
}

func (w Wrapper) dockerComposePath() string {
	return filepath.Join(w.workdir, ".nhost/docker-compose.json")
}

func (w Wrapper) ensureFoldersExistForDockerVolumes(workdir, gitBranch string) error {
	dotNhostFolder := filepath.Join(workdir, ".nhost")

	paths := []string{
		filepath.Join(workdir, ".nhost/custom/keys"),
		filepath.Join(dotNhostFolder, MinioDataDirGitBranchScopedPath(gitBranch)),
		filepath.Join(dotNhostFolder, MailHogDataDirGiBranchScopedPath(gitBranch)),
		filepath.Join(dotNhostFolder, DbDataDirGitBranchScopedPath(gitBranch, dataDirPgdata)),
	}

	for _, folder := range paths {
		if err := os.MkdirAll(folder, os.ModePerm); err != nil {
			return errors.Wrap(err, fmt.Sprintf("failed to create data folder '%s'", folder))
		}
	}

	// write pg_hba_local.conf
	hbaFile := filepath.Join(dotNhostFolder, DbDataDirGitBranchScopedPath(gitBranch, "pg_hba_local.conf"))

	err := os.WriteFile(hbaFile, []byte("local all all trust\nhost all all all trust"), 0777)
	if err != nil {
		return errors.Wrap(err, "could not write pg_hba_local.conf")
	}

	return nil
}

func (w Wrapper) Command(ctx context.Context, args []string, streams *DataStreams) (*exec.Cmd, error) {
	dc := exec.CommandContext(ctx, "docker", append([]string{"compose", "-p", w.composeProjectName, "-f", w.dockerComposePath()}, args...)...)

	if streams != nil {
		// set streams
		dc.Stdout = streams.Stdout
		dc.Stderr = streams.Stderr
		dc.Stdin = os.Stdin
	}

	return dc, nil
}

func CommandWithExistingConfig(ctx context.Context, projectName string, args []string, streams *DataStreams) (*exec.Cmd, error) {
	configFilename := filepath.Join(nhost.DOT_NHOST_DIR, "docker-compose.json")

	if !util.PathExists(configFilename) {
		return nil, fmt.Errorf("The project hasn't been initialized yet. Please run 'nhost dev' first.")
	}

	dc := exec.CommandContext(ctx, "docker", append([]string{"compose", "-p", projectName, "-f", configFilename}, args...)...)

	if streams != nil {
		// set streams
		dc.Stdout = streams.Stdout
		dc.Stderr = streams.Stderr
		dc.Stdin = os.Stdin
	}

	return dc, nil
}
