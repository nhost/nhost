{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "writing";
  description = "Scope and voice resolution, and later the judge, for the Nhost docs and blog writing standard";
  version = "0.0.0-dev";
  submodule = "tools/${name}";

  fs = pkgs.lib.fileset;

  # The whole tool directory, not only .go files: tests read testdata/ and
  # later phases read the rubric YAML and the calibration set. The rules docs
  # and the Vale styles are what the drift test holds the tool to.
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      ../../govulncheck.yaml
      ../../.claude/writing
      ../../.vale/styles/Nhost
      ./.
    ];
  };

  tags = [ ];
  ldflags = [ ];

  checkDeps = [ ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
{
  check = nixops-lib.go.check {
    inherit
      src
      submodule
      ldflags
      tags
      buildInputs
      nativeBuildInputs
      checkDeps
      ;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
    ]
    ++ checkDeps
    ++ buildInputs
    ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit
      name
      description
      version
      src
      submodule
      ldflags
      buildInputs
      nativeBuildInputs
      ;
  };
}
