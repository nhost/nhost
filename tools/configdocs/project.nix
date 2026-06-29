{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "configdocs";
  description = "Generates the nhost.toml configuration reference page from the mimir CUE schema";
  version = "0.0.0-dev";
  submodule = "tools/${name}";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
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
}
