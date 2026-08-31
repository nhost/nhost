{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-go";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  # codegen is the prebuilt binary; gen.sh prefers it over `go run`.
  codegen = self.packages.${pkgs.system}.codegen;

  checkDeps = [
    pkgs.nhost.go
    pkgs.nhost.golangci-lint
    pkgs.gotools # provides goimports (used by gen.sh to prune imports)
    codegen
    # Provides a CA bundle (its setup hook sets SSL_CERT_FILE) so the HTTP
    # client can verify the local backend's certificate in the integration run.
    pkgs.cacert
  ];

  # Source rooted at the repo. The SDK is part of the single root Go module
  # (github.com/nhost/nhost), so the root go.mod/go.sum/vendor must be present;
  # gen.sh resolves the shared OpenAPI specs via REPO_ROOT (../..). Mirrors the
  # root-module layout used by services/* and internal/lib/*.
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      ./gen.sh
      ./README.md
      # The example is part of the root module too (no per-project go.mod), so
      # its sources are included and built/linted alongside the SDK.
      (fs.fileFilter (f: f.hasExt "go") ./.)
      ../../services/auth/docs/openapi.yaml
      ../../services/storage/controller/openapi.yaml
    ];
  };
in
{
  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ [
      pkgs.nhost.nhost-cli
    ];
  };

  check =
    pkgs.runCommand "nhost-go-tests"
      {
        # The integration tests talk to the local backend started by
        # `make dev-env-up`, so the check must run outside the sandbox.
        __noChroot = true;
        nativeBuildInputs = checkDeps;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)
        # The SDK builds as part of the root module against its committed
        # vendor/ tree, so build in vendor mode (offline).
        export GOFLAGS=-mod=vendor
        export GOCACHE="$HOME/gocache"
        export CGO_ENABLED=0

        cp -r ${src} src
        chmod +w -R src
        cd src/${submodule}

        echo "➜ Checking generated clients are up to date (codegen + goimports)"
        cp auth/client.go "$TMPDIR/auth.before"
        cp storage/client.go "$TMPDIR/storage.before"
        sh ./gen.sh
        diff "$TMPDIR/auth.before" auth/client.go \
          || (echo "❌ auth/client.go is stale; run ./gen.sh" && exit 1)
        diff "$TMPDIR/storage.before" storage/client.go \
          || (echo "❌ storage/client.go is stale; run ./gen.sh" && exit 1)

        echo "➜ Checking gofmt"
        unformatted=$(gofmt -l .)
        if [ -n "$unformatted" ]; then
          echo "❌ not gofmt-ed:" && echo "$unformatted" && exit 1
        fi

        echo "➜ Running go vet"
        go vet ./...

        echo "➜ Running golangci-lint"
        golangci-lint run ./...

        echo "➜ Running the offline test suite (no backend)"
        go test ./...

        echo "➜ Running the integration test suite against the local backend"
        export NHOST_LOCAL_BACKEND=1
        go test -tags integration -run TestIntegration ./...

        mkdir $out
      '';

  package =
    pkgs.runCommand "nhost-go"
      {
        nativeBuildInputs = [ pkgs.nhost.go ];
      }
      ''
        export HOME=$(mktemp -d)
        export GOFLAGS=-mod=vendor
        export GOCACHE="$HOME/gocache"
        export CGO_ENABLED=0
        cp -r ${
          fs.toSource {
            root = ../..;
            fileset = fs.unions [
              ../../go.mod
              ../../go.sum
              ../../vendor
              (fs.fileFilter (f: f.hasExt "go") ./.)
            ];
          }
        } src
        chmod +w -R src
        cd src
        go build ./${submodule}/...
        mkdir $out
      '';
}
