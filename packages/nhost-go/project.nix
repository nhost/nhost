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

  # Source rooted at the repo so gen.sh can resolve the shared OpenAPI specs
  # via REPO_ROOT (../..), mirroring nhost-js / nhost-python.
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../.golangci.yaml
      ./go.mod
      ./gen.sh
      ./README.md
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
        export GOFLAGS=-mod=mod
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
        export GOFLAGS=-mod=mod
        export GOCACHE="$HOME/gocache"
        export CGO_ENABLED=0
        cp -r ${
          fs.toSource {
            root = ./.;
            fileset = fs.unions [
              ./go.mod
              (fs.fileFilter (f: f.hasExt "go") ./.)
            ];
          }
        } src
        chmod +w -R src
        cd src
        go build ./...
        mkdir $out
      '';
}
