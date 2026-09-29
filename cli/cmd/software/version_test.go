package software //nolint:testpackage

import (
	"bytes"
	"slices"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

func versionConfig(engineEnabled bool) *model.ConfigConfig {
	cfg := &model.ConfigConfig{
		Auth:     &model.ConfigAuth{Version: new("0.40.0")},
		Storage:  &model.ConfigStorage{Version: new("0.7.0")},
		Postgres: &model.ConfigPostgres{Version: new("14.6-1")},
		Hasura:   &model.ConfigHasura{Version: new("v2.25.0")},
	}

	if engineEnabled {
		cfg.Experimental = &model.ConfigExperimental{
			Nhost: &model.ConfigNhost{Version: new("0.0.5")},
		}
	}

	return cfg
}

func softwareTypes(services []serviceVersion) []graphql.SoftwareTypeEnum {
	types := make([]graphql.SoftwareTypeEnum, 0, len(services))
	for _, service := range services {
		types = append(types, service.software)
	}

	return types
}

func contains(types []graphql.SoftwareTypeEnum, want graphql.SoftwareTypeEnum) bool {
	return slices.Contains(types, want)
}

func TestCheckServiceVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		software          graphql.SoftwareTypeEnum
		currentVersion    string
		availableVersions *graphql.GetSoftwareVersions
		changelog         string
		wantStdout        string
		wantStderr        string
	}{
		{
			name:           "current version is recommended",
			software:       graphql.SoftwareTypeEnumAuth,
			currentVersion: "0.40.0",
			availableVersions: &graphql.GetSoftwareVersions{
				SoftwareVersions: []*graphql.GetSoftwareVersions_SoftwareVersions{
					{
						Software: graphql.SoftwareTypeEnumAuth,
						Version:  "0.40.0",
					},
				},
			},
			changelog:  nhostReleasesURL,
			wantStdout: "✅ Auth is already on a recommended version: 0.40.0\n",
			wantStderr: "",
		},
		{
			name:           "current version is not recommended",
			software:       graphql.SoftwareTypeEnumEngine,
			currentVersion: "0.0.1",
			availableVersions: &graphql.GetSoftwareVersions{
				SoftwareVersions: []*graphql.GetSoftwareVersions_SoftwareVersions{
					{
						Software: graphql.SoftwareTypeEnumEngine,
						Version:  "1.0.0",
					},
					{
						Software: graphql.SoftwareTypeEnumEngine,
						Version:  "1.1.0",
					},
				},
			},
			changelog: nhostReleasesURL,
			wantStdout: "🟡 Engine is not on a recommended version. Recommended: 1.0.0, 1.1.0\n" +
				"   More info: https://github.com/nhost/nhost/releases\n",
			wantStderr: "",
		},
		{
			name:           "no versions published for software",
			software:       graphql.SoftwareTypeEnumEngine,
			currentVersion: "0.0.1",
			availableVersions: &graphql.GetSoftwareVersions{
				SoftwareVersions: []*graphql.GetSoftwareVersions_SoftwareVersions{
					{
						Software: graphql.SoftwareTypeEnumStorage,
						Version:  "0.7.0",
					},
				},
			},
			changelog:  nhostReleasesURL,
			wantStdout: "",
			wantStderr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stdout, stderr bytes.Buffer

			ce := clienv.New(
				&stdout,
				&stderr,
				clienv.NewPathStructure("", "", "", ""),
				"",
				"",
				"",
				"",
				"",
				"",
				"",
			)

			checkServiceVersion(
				ce,
				tt.software,
				tt.currentVersion,
				tt.availableVersions,
				tt.changelog,
			)

			if got := stdout.String(); got != tt.wantStdout {
				t.Errorf("stdout = %q, want %q", got, tt.wantStdout)
			}

			if got := stderr.String(); got != tt.wantStderr {
				t.Errorf("stderr = %q, want %q", got, tt.wantStderr)
			}
		})
	}
}

func TestServicesToCheckToleratesNilConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  *model.ConfigConfig
	}{
		{
			name: "outside a project",
			cfg:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := servicesToCheck(tt.cfg); len(got) != 0 {
				t.Errorf("servicesToCheck() = %v, want no services", got)
			}
		})
	}
}

// TestServicesToCheckEngineReplacesAuthAndStorage covers the reason this
// selection exists: with the engine enabled, auth and storage are not deployed
// and mimir rejects per-service versions, so recommending versions for them
// would be advice the user cannot act on.
func TestServicesToCheckEngineReplacesAuthAndStorage(t *testing.T) {
	t.Parallel()

	got := softwareTypes(servicesToCheck(versionConfig(true)))

	if !contains(got, graphql.SoftwareTypeEnumEngine) {
		t.Errorf("engine version is not checked: %v", got)
	}

	for _, unwanted := range []graphql.SoftwareTypeEnum{
		graphql.SoftwareTypeEnumAuth,
		graphql.SoftwareTypeEnumStorage,
	} {
		if contains(got, unwanted) {
			t.Errorf("%s is still checked while the engine is enabled: %v", unwanted, got)
		}
	}

	// Hasura and postgres keep running alongside the engine.
	for _, wanted := range []graphql.SoftwareTypeEnum{
		graphql.SoftwareTypeEnumHasura,
		graphql.SoftwareTypeEnumPostgreSQL,
	} {
		if !contains(got, wanted) {
			t.Errorf("%s should still be checked: %v", wanted, got)
		}
	}
}

func TestServicesToCheckStandaloneIsUnchanged(t *testing.T) {
	t.Parallel()

	got := softwareTypes(servicesToCheck(versionConfig(false)))

	want := []graphql.SoftwareTypeEnum{
		graphql.SoftwareTypeEnumAuth,
		graphql.SoftwareTypeEnumStorage,
		graphql.SoftwareTypeEnumPostgreSQL,
		graphql.SoftwareTypeEnumHasura,
	}

	if len(got) != len(want) {
		t.Fatalf("checked services changed:\n  got:  %v\n  want: %v", got, want)
	}

	for i, wanted := range want {
		if got[i] != wanted {
			t.Errorf("service %d: got %s, want %s", i, got[i], wanted)
		}
	}

	if contains(got, graphql.SoftwareTypeEnumEngine) {
		t.Error("engine is checked without experimental.nhost")
	}
}

// TestServicesToCheckReportsEngineVersion guards the value itself: reporting
// the engine under a stale auth or storage version would be worse than not
// reporting it at all.
func TestServicesToCheckReportsEngineVersion(t *testing.T) {
	t.Parallel()

	for _, service := range servicesToCheck(versionConfig(true)) {
		if service.software != graphql.SoftwareTypeEnumEngine {
			continue
		}

		if service.version != "0.0.5" {
			t.Errorf("engine version = %q, want %q", service.version, "0.0.5")
		}

		return
	}

	t.Fatal("engine was not among the checked services")
}

// TestServicesToCheckToleratesUnsetEngineVersion pins the engine-specific nil
// guard: a hand-built config with no engine version skips the engine without
// falling back to standalone auth.
func TestServicesToCheckToleratesUnsetEngineVersion(t *testing.T) {
	t.Parallel()

	cfg := versionConfig(true)
	cfg.Experimental.Nhost.Version = nil

	got := softwareTypes(servicesToCheck(cfg))

	if contains(got, graphql.SoftwareTypeEnumEngine) {
		t.Errorf("engine checked without a version: %v", got)
	}

	if contains(got, graphql.SoftwareTypeEnumAuth) {
		t.Errorf("auth checked while the engine is enabled: %v", got)
	}
}
