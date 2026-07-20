{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-go-run";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  # Own module, standard-library only: the fileset needs just its go.mod, the
  # Go sources and the shared linter config. No vendor dir / go.sum because it
  # has no third-party dependencies, so the check runs hermetically.
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../.golangci.yaml
      ./go.mod
      ./README.md
      (fs.fileFilter (f: f.hasExt "go") ./.)
    ];
  };

  checkDeps = [
    pkgs.nhost.go
    pkgs.nhost.golangci-lint
  ];
in
{
  check =
    pkgs.runCommand "${name}-tests"
      {
        nativeBuildInputs = checkDeps;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)
        export GOFLAGS=-mod=mod
        export GOEXPERIMENT=jsonv2
        export GOCACHE="$HOME/gocache"
        export CGO_ENABLED=0

        cp -r ${src} src
        chmod +w -R src
        cd src/${submodule}

        echo "➜ Checking gofmt"
        unformatted=$(gofmt -l .)
        if [ -n "$unformatted" ]; then
          echo "❌ not gofmt-ed:" && echo "$unformatted" && exit 1
        fi

        echo "➜ Running go vet"
        go vet ./...

        echo "➜ Running golangci-lint"
        golangci-lint run ./...

        echo "➜ Running tests"
        go test ./...

        mkdir $out
      '';

  devShell = pkgs.mkShell {
    buildInputs = checkDeps;

    shellHook = "export GOEXPERIMENT=jsonv2";
  };

  package =
    pkgs.runCommand "${name}"
      {
        nativeBuildInputs = [ pkgs.nhost.go ];
      }
      ''
        export HOME=$(mktemp -d)
        export GOFLAGS=-mod=mod
        export GOEXPERIMENT=jsonv2
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
