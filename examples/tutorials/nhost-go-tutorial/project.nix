{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-go-tutorial";
  version = "0.0.0-dev";
  submodule = "examples/tutorials/${name}";

  fs = pkgs.lib.fileset;

  checkDeps = [
    pkgs.nhost.go
    pkgs.nhost.golangci-lint
  ];

  # Rooted at the repo: this example is part of the single root Go module
  # (github.com/nhost/nhost) and builds against the committed vendor/ tree, so
  # the root go.mod/go.sum/vendor and the SDK's sources must be present.
  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ../../../go.mod
      ../../../go.sum
      ../../../vendor
      ../../../.golangci.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
      (fs.fileFilter (f: f.hasExt "go") ../../../packages/nhost-go)
    ];
  };
in
{
  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ [ pkgs.nhost.nhost-cli ];
  };

  # The tutorial pages are written against this program, so an example that
  # stops compiling against the SDK means the docs have gone stale. Compiling it
  # here is what keeps that from happening silently.
  check =
    pkgs.runCommand "${name}-tests"
      {
        nativeBuildInputs = checkDeps;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)
        export GOFLAGS=-mod=vendor
        export GOCACHE="$HOME/gocache"
        export CGO_ENABLED=0

        cp -r ${src} src
        chmod +w -R src
        cd src

        echo "➜ Checking gofmt"
        unformatted=$(gofmt -l ./${submodule})
        if [ -n "$unformatted" ]; then
          echo "❌ not gofmt-ed:" && echo "$unformatted" && exit 1
        fi

        echo "➜ Running go vet"
        go vet ./${submodule}/...

        echo "➜ Running golangci-lint"
        golangci-lint run ./${submodule}/...

        echo "➜ Running the test suite"
        go test ./${submodule}/...

        mkdir $out
      '';
}
