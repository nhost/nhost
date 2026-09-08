{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-go-tutorial";

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

  # docs_snippets_test.go compiles the programs published on the tutorial pages,
  # so those pages are inputs to this check. They sit outside the module, so the
  # test is told where they are.
  tutorialPages = fs.toSource {
    root = ../../../docs/src/content/docs/getting-started/tutorials/go;
    fileset = ../../../docs/src/content/docs/getting-started/tutorials/go;
  };

  moduleSrc = fs.toSource {
    root = ./.;
    fileset = fs.unions [
      ./go.mod
      ./go.sum
      (fs.fileFilter (f: f.hasExt "go") ./.)
    ];
  };

  # This example is its own Go module. The shared check resolves every step
  # against the root of its source, so the source is the module directory, with
  # the repository's lint and govulncheck configuration copied beside it. The
  # go.mod's relative replace of the SDK cannot resolve from the store, so it is
  # pointed at the SDK's store path instead. Its other requirements (urfave/cli)
  # are downloaded by the check, which runs outside the sandbox.
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

  # The tutorial pages are written against this program, so an example that
  # stops compiling against the SDK means the docs have gone stale. Compiling it
  # here is what keeps that from happening silently.
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

    impureEnvVars = {
      NHOST_GO_TUTORIAL_PAGES = "${tutorialPages}";
    };
  };
}
