{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "cat-uploader";

  fs = pkgs.lib.fileset;

  tags = [ ];
  ldflags = [ ];
  buildInputs = [ ];
  nativeBuildInputs = [ ];
  checkDeps = [ ];

  sdkSrc = fs.toSource {
    root = ../../../packages/nhost-go;
    fileset = fs.unions [
      ../../../packages/nhost-go/go.mod
      (fs.fileFilter (f: f.hasExt "go") ../../../packages/nhost-go)
    ];
  };

  moduleSrc = fs.toSource {
    root = ./.;
    fileset = fs.unions [
      ./go.mod
      (fs.fileFilter (f: f.hasExt "go") ./.)
    ];
  };

  # This example is its own Go module. The shared check resolves every step
  # against the root of its source, so the source is the module directory, with
  # the repository's lint and govulncheck configuration copied beside it. The
  # go.mod's relative replace of the SDK cannot resolve from the store, so it is
  # pointed at the SDK's store path instead.
  src = pkgs.runCommand "${name}-src" { nativeBuildInputs = [ pkgs.nhost.go ]; } ''
    cp -r ${moduleSrc} $out
    chmod +w -R $out
    cp ${../../../.golangci.yaml} $out/.golangci.yaml
    cp ${../../../govulncheck.yaml} $out/govulncheck.yaml
    cd $out
    go mod edit -replace=github.com/nhost/nhost/packages/nhost-go=${sdkSrc}
  '';
in
{
  devShell = nixops-lib.go.devShell {
    buildInputs = [ pkgs.nhost.nhost-cli ];
  };

  # A Run service example: it carries its own tests (main_test.go), so the check
  # runs them alongside the lint that keeps it honest against the SDK's API.
  check = nixops-lib.go.check {
    inherit
      src
      ldflags
      tags
      buildInputs
      nativeBuildInputs
      checkDeps
      ;

    submodule = ".";
  };
}
