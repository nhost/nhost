package nhost

import (
	"context"
	"github.com/hashicorp/go-getter"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
	"path/filepath"
)

func NewTemplatesInstaller(logger logrus.FieldLogger) *templatesInstaller {
	return &templatesInstaller{logger: logger}
}

type templatesInstaller struct {
	logger logrus.FieldLogger
}

func (t *templatesInstaller) Install(ctx context.Context, destination, repository, path string) error {
	repo := filepath.Join(repository, path)
	return t.clone(ctx, repo, destination)
}

func (t *templatesInstaller) clone(ctx context.Context, src, dest string) error {
	t.logger.Debugf("Cloning %s to %s", src, util.Rel(dest))

	//  initialize hashicorp go-getter client
	client := &getter.Client{
		Ctx: ctx,
		// define the destination to where the directory will be stored. This will create the directory if it doesnt exist
		Dst:  dest,
		Src:  src,
		Pwd:  util.WORKING_DIR,
		Mode: getter.ClientModeAny,
		// define the type of detectors go getter should use, in this case only github is needed
		Detectors: []getter.Detector{
			&getter.GitHubDetector{},
		},
	}

	return client.Get()
}

// Template represents a structure for a template
type Template struct {
	Name        string
	Destination *string
	Path        string
	Repository  string
}
