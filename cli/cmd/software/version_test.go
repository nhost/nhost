package software //nolint:testpackage

import (
	"slices"
	"testing"

	"github.com/nhost/be/services/mimir/model"
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

// TestServicesToCheckEngineReplacesAuthAndStorage covers the reason this
// selection exists: with the engine enabled, auth and storage are not deployed
// and mimir rejects per-service versions, so recommending versions for them
// would be advice the user cannot act on.
func TestServicesToCheckEngineReplacesAuthAndStorage(t *testing.T) {
	t.Parallel()

	got := softwareTypes(servicesToCheck(versionConfig(true)))

	if !contains(got, softwareTypeEngine) {
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

	if contains(got, softwareTypeEngine) {
		t.Error("engine is checked without experimental.nhost")
	}
}

// TestServicesToCheckReportsEngineVersion guards the value itself: reporting
// the engine under a stale auth or storage version would be worse than not
// reporting it at all.
func TestServicesToCheckReportsEngineVersion(t *testing.T) {
	t.Parallel()

	for _, service := range servicesToCheck(versionConfig(true)) {
		if service.software != softwareTypeEngine {
			continue
		}

		if service.version != "0.0.5" {
			t.Errorf("engine version = %q, want %q", service.version, "0.0.5")
		}

		return
	}

	t.Fatal("engine was not among the checked services")
}

// TestServicesToCheckToleratesUnsetEngineVersion keeps a config that has not
// been filled from panicking a version check.
func TestServicesToCheckToleratesUnsetEngineVersion(t *testing.T) {
	t.Parallel()

	cfg := versionConfig(true)
	cfg.Experimental.Nhost.Version = nil

	got := softwareTypes(servicesToCheck(cfg))

	if contains(got, softwareTypeEngine) {
		t.Errorf("engine checked without a version: %v", got)
	}

	if contains(got, graphql.SoftwareTypeEnumAuth) {
		t.Errorf("auth checked while the engine is enabled: %v", got)
	}
}
