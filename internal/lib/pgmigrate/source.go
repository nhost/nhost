package pgmigrate

import (
	"bytes"
	"errors"
	"io"

	"github.com/golang-migrate/migrate/v4/source"
)

var (
	_                   source.Driver = (*catalogSource)(nil)
	errCatalogSourceURL               = errors.New("catalog source cannot be opened from a URL")
)

type catalogSource struct {
	catalog *catalog
}

func newCatalogSource(catalog *catalog) *catalogSource {
	return &catalogSource{catalog: catalog}
}

func (s *catalogSource) Open( //nolint:ireturn // source.Driver contract.
	string,
) (source.Driver, error) {
	return nil, errCatalogSourceURL
}

func (s *catalogSource) Close() error {
	return nil
}

func (s *catalogSource) First() (uint, error) {
	return s.catalog.first()
}

func (s *catalogSource) Prev(version uint) (uint, error) {
	return s.catalog.previous(version)
}

func (s *catalogSource) Next(version uint) (uint, error) {
	return s.catalog.next(version)
}

func (s *catalogSource) ReadUp(version uint) (io.ReadCloser, string, error) {
	return s.read(version, source.Up)
}

func (s *catalogSource) ReadDown(version uint) (io.ReadCloser, string, error) {
	return s.read(version, source.Down)
}

func (s *catalogSource) read(
	version uint,
	direction source.Direction,
) (io.ReadCloser, string, error) {
	body, identifier, err := s.catalog.read(version, direction)
	if err != nil {
		return nil, "", err
	}

	return io.NopCloser(bytes.NewReader(body)), identifier, nil
}
