package git

import (
	"errors"
	g "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

type client struct {
	r *g.Repository
}

func NewClient(path string) (*client, error) {
	r, err := g.PlainOpen(path)
	if err != nil {
		return nil, err
	}

	return &client{r: r}, nil
}

func (c client) RefName() (string, error) {
	ref, err := c.r.Head()
	if err != nil {
		// this may happen on a new repository without commits
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return defaultGitBranch, nil
		}

		return "", err
	}

	return ref.Name().Short(), nil
}
