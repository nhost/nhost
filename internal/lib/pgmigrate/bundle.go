package pgmigrate

import (
	"crypto/sha256"
	"fmt"
	"io/fs"
	"math"
	"path"
	"slices"

	"github.com/golang-migrate/migrate/v4/source"
)

type migration struct {
	version         uint
	previousVersion *uint
	identifier      string
	upSQL           []byte
	downSQL         []byte
	upChecksum      [sha256.Size]byte
	downChecksum    [sha256.Size]byte
}

type bundle struct {
	migrations []migration
	target     uint
}

type migrationFile struct {
	identifier string
	body       []byte
	checksum   [sha256.Size]byte
}

type migrationPair struct {
	up   *migrationFile
	down *migrationFile
}

func loadBundle(fsys fs.FS, migrationPath string) (*bundle, error) {
	if fsys == nil {
		return nil, &ConfigurationError{
			Field: "filesystem",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	if !fs.ValidPath(migrationPath) {
		return nil, &ConfigurationError{
			Field: "path",
			Issue: "must be a valid io/fs path",
			Cause: nil,
		}
	}

	entries, err := fs.ReadDir(fsys, migrationPath)
	if err != nil {
		return nil, &ConfigurationError{
			Field: "path",
			Issue: fmt.Sprintf("cannot read %q", migrationPath),
			Cause: err,
		}
	}

	pairs, err := readMigrationPairs(fsys, migrationPath, entries)
	if err != nil {
		return nil, err
	}

	return linkBundle(migrationPath, pairs)
}

func readMigrationPairs(
	fsys fs.FS,
	migrationPath string,
	entries []fs.DirEntry,
) (map[uint]*migrationPair, error) {
	pairs := make(map[uint]*migrationPair)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		if err := addMigrationFile(fsys, migrationPath, entry.Name(), pairs); err != nil {
			return nil, err
		}
	}

	if len(pairs) == 0 {
		return nil, &BundleError{
			Path:  migrationPath,
			Issue: "contains no migration files",
			Cause: nil,
		}
	}

	return pairs, nil
}

func addMigrationFile(
	fsys fs.FS,
	migrationPath string,
	name string,
	pairs map[uint]*migrationPair,
) error {
	parsed, err := source.Parse(name)
	if err != nil {
		return &BundleError{
			Path:  path.Join(migrationPath, name),
			Issue: "filename does not follow golang-migrate semantics",
			Cause: err,
		}
	}

	pair, found := pairs[parsed.Version]
	if !found {
		pair = &migrationPair{
			up:   nil,
			down: nil,
		}
		pairs[parsed.Version] = pair
	}

	if hasDirection(pair, parsed.Direction) {
		return &BundleError{
			Path: path.Join(migrationPath, name),
			Issue: fmt.Sprintf(
				"duplicates the %s migration for version %d",
				parsed.Direction,
				parsed.Version,
			),
			Cause: nil,
		}
	}

	body, err := fs.ReadFile(fsys, path.Join(migrationPath, name))
	if err != nil {
		return &BundleError{
			Path:  path.Join(migrationPath, name),
			Issue: "cannot read migration body",
			Cause: err,
		}
	}

	if !containsMigrationSQL(body) {
		return &BundleError{
			Path:  path.Join(migrationPath, name),
			Issue: "migration body must contain SQL beyond comments and whitespace",
			Cause: nil,
		}
	}

	file := &migrationFile{
		identifier: parsed.Identifier,
		body:       body,
		checksum:   sha256.Sum256(body),
	}

	return setDirection(pair, parsed.Direction, file, migrationPath, name)
}

func hasDirection(pair *migrationPair, direction source.Direction) bool {
	switch direction {
	case source.Up:
		return pair.up != nil
	case source.Down:
		return pair.down != nil
	default:
		return false
	}
}

func setDirection(
	pair *migrationPair,
	direction source.Direction,
	file *migrationFile,
	migrationPath string,
	name string,
) error {
	switch direction {
	case source.Up:
		pair.up = file
	case source.Down:
		pair.down = file
	default:
		return &BundleError{
			Path:  path.Join(migrationPath, name),
			Issue: fmt.Sprintf("has unsupported direction %q", direction),
			Cause: nil,
		}
	}

	return nil
}

func linkBundle(migrationPath string, pairs map[uint]*migrationPair) (*bundle, error) {
	versions := make([]uint, 0, len(pairs))
	for version := range pairs {
		versions = append(versions, version)
	}

	slices.Sort(versions)

	migrations := make([]migration, 0, len(versions))
	for index, version := range versions {
		linked, err := linkMigration(migrationPath, pairs[version], versions, index)
		if err != nil {
			return nil, err
		}

		migrations = append(migrations, linked)
	}

	maximum := versions[len(versions)-1]
	if uint64(maximum) > uint64(math.MaxInt) {
		return nil, &BundleError{
			Path: migrationPath,
			Issue: fmt.Sprintf(
				"maximum version %d exceeds the migration runner's integer version range",
				maximum,
			),
			Cause: nil,
		}
	}

	return &bundle{
		migrations: migrations,
		target:     maximum,
	}, nil
}

func linkMigration(
	migrationPath string,
	pair *migrationPair,
	versions []uint,
	index int,
) (migration, error) {
	version := versions[index]
	if pair.up == nil {
		return migration{}, &BundleError{
			Path:  migrationPath,
			Issue: fmt.Sprintf("version %d is missing its up migration", version),
			Cause: nil,
		}
	}

	if pair.down == nil {
		return migration{}, &BundleError{
			Path:  migrationPath,
			Issue: fmt.Sprintf("version %d is missing its down migration", version),
			Cause: nil,
		}
	}

	if pair.up.identifier != pair.down.identifier {
		return migration{}, &BundleError{
			Path: migrationPath,
			Issue: fmt.Sprintf(
				"version %d has mismatched identifiers %q and %q",
				version,
				pair.up.identifier,
				pair.down.identifier,
			),
			Cause: nil,
		}
	}

	var previousVersion *uint
	if index > 0 {
		previous := versions[index-1]
		previousVersion = &previous
	}

	return migration{
		version:         version,
		previousVersion: previousVersion,
		identifier:      pair.up.identifier,
		upSQL:           pair.up.body,
		downSQL:         pair.down.body,
		upChecksum:      pair.up.checksum,
		downChecksum:    pair.down.checksum,
	}, nil
}
